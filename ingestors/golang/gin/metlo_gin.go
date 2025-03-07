package metloGin

import (
	"bytes"
	"io/ioutil"
	"log"
	"net"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	metlo "github.com/metlo-labs/metlo/ingestors/golang/metlo"
)

const MAX_BODY int = 10 * 1024

type metloApp interface {
	Send(data metlo.MetloTrace)
	ShouldBlock(request metlo.TraceReq, meta metlo.TraceMeta) bool
	UpdateRateLimit(data metlo.MetloTrace)
	Allow() bool
}

type bodyLogWriter struct {
	gin.ResponseWriter
	body         *bytes.Buffer
	bytesWritten *int
}

type metloInstrumentation struct {
	app        metloApp
	serverHost string
	serverPort int
	getUser    func(*gin.Context) *string
}

func Init(app metloApp) metloInstrumentation {
	return CustomInit(app, "localhost", 0, nil)
}

func CustomInit(app metloApp, serverHost string, serverPort int, getUser func(*gin.Context) *string) metloInstrumentation {
	return metloInstrumentation{
		app:        app,
		serverHost: serverHost,
		serverPort: serverPort,
		getUser:    getUser,
	}
}

func min(a int, b int) int {
	if a < b {
		return a
	}
	return b
}

func (w bodyLogWriter) Write(b []byte) (int, error) {
	var byte_length = len(b)
	var bytes_to_write int = min(min(MAX_BODY, byte_length), MAX_BODY-*w.bytesWritten)
	*w.bytesWritten = *w.bytesWritten + bytes_to_write
	var sub_buffer []byte = b[0:bytes_to_write]
	w.body.Write(sub_buffer)
	return w.ResponseWriter.Write(b)
}

func (m *metloInstrumentation) Middleware(c *gin.Context) {
	var bytesWritten *int = new(int)
	*bytesWritten = 0
	blw := &bodyLogWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer, bytesWritten: bytesWritten}
	c.Writer = blw
	body, _ := ioutil.ReadAll(c.Request.Body)
	c.Request.Body.Close()
	c.Request.Body = ioutil.NopCloser(bytes.NewReader(body))

	if m.app.Allow() {
		reqHeaders := make([]metlo.NV, 0)
		for k := range c.Request.Header {
			reqHeaders = append(reqHeaders, metlo.NV{Name: k, Value: strings.Join(c.Request.Header[k], ",")})
		}
		queryMap := c.Request.URL.Query()
		queryParams := make([]metlo.NV, 0)
		for k := range queryMap {
			queryParams = append(queryParams, metlo.NV{Name: k, Value: strings.Join(queryMap[k], ",")})
		}
		_, sourcePortRaw, err := net.SplitHostPort(c.Request.RemoteAddr)
		if err != nil {
			log.Println("Metlo couldn't find source port for incoming request")
		}

		sourcePort, err := strconv.Atoi(sourcePortRaw)
		if err != nil {
			log.Println("Metlo couldn't find source port for incoming request")
		}

		var user *string
		if m.getUser != nil {
			user = m.getUser(c)
		} else {
			user = nil
		}

		request := metlo.TraceReq{
			Url: metlo.TraceUrl{
				Host:       c.Request.Host,
				Path:       c.Request.URL.Path,
				Parameters: queryParams,
			},
			Headers: reqHeaders,
			Body:    string(body),
			Method:  c.Request.Method,
			User:    user,
		}
		meta := metlo.TraceMeta{
			Environment:     "production",
			Incoming:        true,
			Source:          c.ClientIP(),
			SourcePort:      sourcePort,
			Destination:     m.serverHost,
			DestinationPort: m.serverPort,
			MetloSource:     "go/gin",
		}

		if m.app.ShouldBlock(request, meta) {
			c.String(403, "Forbidden")
			c.Abort()
		} else {
			c.Next()
		}

		resHeaderMap := c.Writer.Header()
		resHeaders := make([]metlo.NV, 0)
		for k := range resHeaderMap {
			resHeaders = append(resHeaders, metlo.NV{Name: k, Value: strings.Join(resHeaderMap[k], ",")})
		}

		tr := metlo.MetloTrace{
			Request: request,
			Response: metlo.TraceRes{
				Status:  blw.Status(),
				Body:    blw.body.String(),
				Headers: resHeaders,
			},
			Meta: meta,
		}

		m.app.UpdateRateLimit(tr)

		go m.app.Send(tr)
	} else {
		c.Next()
	}
}

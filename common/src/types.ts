import {
  AlertType,
  __DataClass_INTERNAL__,
  DataSection,
  DataTag,
  DataType,
  RestMethod,
  RiskScore,
  SpecExtension,
  Status,
  AuthType,
  AttackType,
  API_KEY_TYPE,
  DisableRestMethod,
  GraphQlOperation,
  AnalysisType,
} from "./enums"
import "axios"
import { TestConfig } from "@metlo/testing"

export interface Meta {
  incoming: boolean
  source: string
  sourcePort: string
  destination: string
  destinationPort: string
  originalSource?: string
}

export interface SessionMeta {
  authenticationProvided: boolean
  authenticationSuccessful: boolean
  authType: AuthType
  uniqueSessionKey?: string
  user?: string
}

export interface PairObject {
  name: string
  value: string
}

export interface Url {
  host: string
  path: string
  endpointPath?: string
  parameters: PairObject[]
}

declare module "axios" {
  interface AxiosRequestConfig {
    metadata?: Record<string, any>
  }
  interface AxiosResponseConfig {
    metadata?: Record<string, any>
  }
  interface AxiosResponse {
    duration?: number
  }
}

export interface Request {
  url: Url
  headers: PairObject[]
  body: string
  method: RestMethod
}

export interface Response {
  status: number
  headers: PairObject[]
  body: string
}

export interface OperationItem {
  name: string
  alias: string
  arguments: string[]
  items: OperationItem[]
}

export interface Variable {
  name: string
  varType: string
}

export interface Operation {
  operationName: string
  operationType: GraphQlOperation
  items: OperationItem[]
  variables: Variable[]
}

export interface ProcessedTraceData {
  block: boolean
  attackDetections?: Record<string, string[]>
  xssDetected?: Record<string, string>
  sqliDetected?: Record<string, [string, string]>
  sensitiveDataDetected: Record<string, string[]>
  dataTypes: Record<string, string[]>
  requestContentType: string
  responseContentType: string
  graphqlPaths?: string[]
  validationErrors?: Record<string, string[]>
}

export interface Encryption {
  key: string
  generatedIvs: Record<string, number[]>
}

export interface TraceParams {
  request: Request
  response: Response
  meta: Meta
  processedTraceData?: ProcessedTraceData
  redacted?: boolean
  sessionMeta?: SessionMeta
  encryption?: Encryption
  analysisType?: AnalysisType
  graphqlPaths?: string[]
}

export interface GetAttackParams {
  hosts?: string[]
  riskScores?: RiskScore[]
  offset?: number
  limit?: number
  status?: boolean
}

export type JSONValue =
  | string
  | number
  | boolean
  | { [x: string]: JSONValue }
  | Array<JSONValue>

export interface QueuedApiTrace {
  path: string
  endpointPath?: string
  createdAt: Date
  host: string
  method: RestMethod
  requestParameters: PairObject[]
  requestHeaders: PairObject[]
  requestBody: string
  responseStatus: number
  responseHeaders: PairObject[]
  responseBody: string
  meta: Meta
  sessionMeta: SessionMeta
  processedTraceData?: ProcessedTraceData
  redacted?: boolean
  originalHost?: string
  encryption?: Encryption
  analysisType?: AnalysisType
  graphqlPaths?: string[]
}

export interface ApiTrace extends QueuedApiTrace {
  redacted: boolean
  uuid: string
  apiEndpointUuid: string
}

export interface Alert {
  uuid: string
  type: AlertType
  riskScore: RiskScore
  apiEndpointUuid: string
  apiEndpoint: {
    uuid: string
    method: RestMethod
    host: string
    path: string
    openapiSpecName: string
    openapiSpec: {
      extension: SpecExtension
      minimizedSpecContext: Record<string, MinimizedSpecContext>
    }
  }
  description: string
  createdAt: Date
  updatedAt: Date
  status: Status
  resolutionMessage: string
  context: object
}

export interface DataField {
  uuid: string
  dataClasses: string[]
  dataPath: string
  dataSection: DataSection
  dataType: DataType
  dataTag: DataTag
  falsePositives: string[]
  scannerIdentified: string[]
  createdAt: Date
  updatedAt: Date
  matches: Record<string, string[]>
  apiEndpointUuid: string
  statusCode: number
  contentType: string
  isNullable: boolean
  entity: string
  apiEndpoint?: ApiEndpoint
}

export interface ApiEndpoint {
  uuid: string
  path: string
  createdAt: Date
  updatedAt: Date
  resourcePermissions: string[]
  dataClasses?: string[]
  firstDetected?: Date
  lastActive?: Date
  host: string
  method: RestMethod
  owner: string
  riskScore: RiskScore
  openapiSpecName: string
  isAuthenticatedDetected: boolean
  isAuthenticatedUserSet: boolean
  fullTraceCaptureEnabled: boolean
  isGraphQl: boolean
  isPublic?: boolean
}

export interface ApiEndpointDetailed extends ApiEndpoint {
  openapiSpec: OpenApiSpec
  alerts: Alert[]
  traces: ApiTrace[]
  tests: any[]
  dataFields: DataField[]
  globalFullTraceCapture?: boolean
  userSet: boolean
  graphQlSchema: string | null
}

export interface HostResponse {
  host: string
  numEndpoints: number
  isPublic: boolean
}

export interface OpenApiSpec {
  name: string
  spec: string
  isAutoGenerated: boolean
  extension: SpecExtension
  createdAt: Date
  updatedAt: Date
  hosts: string[]
  specUpdatedAt: Date
}

export interface UsageStats {
  dailyUsage: { day: string; cnt: number }[]
  last1MinCnt: number
}

export interface Summary {
  highRiskAlerts: number
  newAlerts: number
  endpointsTracked: number
  piiDataFields: number
  hostCount: number
  piiDataTypeCount: Map<string, number>
  alertTypeCount: Map<AlertType, number>
  topAlerts: Alert[]
  topEndpoints: ApiEndpointDetailed[]
  usageStats: UsageStats
  numConnections: number
}

export interface Usage {
  date: Date
  count: number
}

export interface PIIDataClassAggItem {
  dataClass: string
  risk: RiskScore
  count: number
  numEndpoints: number
  numHosts: number
}

export interface SensitiveDataSummary {
  piiDataTypeCount: Map<string, number>
  piiItems: PIIDataClassAggItem[]
  totalPIIFields: number
  totalEndpoints: number
}

export interface VulnerabilityAggItem {
  type: AlertType
  risk: RiskScore
  count: number
  numEndpoints: number
  numHosts: number
}

export interface VulnerabilitySummary {
  vulnerabilityTypeCount: Map<AlertType, number>
  vulnerabilityItems: VulnerabilityAggItem[]
  totalVulnerabilities: number
  totalEndpoints: number
}

export interface AttackMeta {
  averageRPS?: number
  currentRPS?: number
}

export interface Attack {
  uuid: string
  createdAt: Date
  riskScore: RiskScore
  attackType: AttackType
  description: string
  metadata: AttackMeta
  startTime: Date
  endTime: Date

  uniqueSessionKey: string
  sourceIP: string
  apiEndpointUuid: string
  apiEndpoint: ApiEndpoint
  host: string

  resolved: boolean
  snoozed: boolean
  snoozeHours: number
}

export interface AttackResponse {
  attackTypeCount: Record<AttackType, number>
  attacks: Attack[]
  totalAttacks: number
  totalEndpoints: number
  validLicense: boolean
}

export interface AttackDetailResponse {
  attack: Attack
  traces: ApiTrace[]
  validLicense: boolean
}

export interface InstanceSettings {
  uuid: string
  updateEmail: string
  skippedUpdateEmail: boolean
}

export interface MinimizedSpecContext {
  lineNumber: number
  minimizedSpec: string
}

export interface ApiKey {
  name: string
  identifier: string
  created: string
  for: API_KEY_TYPE
}

export interface AuthenticationConfig {
  host: string
  authType: AuthType
  headerKey: string
  jwtUserPath: string
  cookieName: string
}

export interface DisabledPathSection {
  reqQuery: string[]
  reqHeaders: string[]
  reqBody: string[]
  resHeaders: string[]
  resBody: string[]
}

export interface BlockFieldEntry {
  path: string
  pathRegex: string
  method: DisableRestMethod
  numberParams: number
  disabledPaths: DisabledPathSection
}

export interface UpdateMetloConfigParams {
  configString: string
}

export interface MetloConfigResp {
  uuid: string
  configString: string
  encryptionPublicKey?: string
}

export interface WebhookRun {
  ok: boolean
  msg: string
  payload: Alert
}

export interface WebhookResp {
  uuid: string
  createdAt: Date
  url: string
  maxRetries: number
  alertTypes: AlertType[]
  hosts: string[]
  runs: WebhookRun[]
}

export interface HostGraph {
  hosts: { [key: string]: { numEndpoints: number } }
  edges: {
    srcHost: string
    dstHost: string
    numEndpoints: number
  }[]
}

export interface GenerateTestParams {
  type: string
  endpoint: string
  version?: number
  host?: string
}

export interface GenerateTestRes {
  success: boolean
  templateName?: string
  templateVersion?: number
  msg?: string
  test?: TestConfig
}

export interface DataClass {
  className: string
  severity: RiskScore
  regex?: string
  keyRegex?: string
  shortName?: string
}

export interface TestingConfigResp {
  uuid: string
  configString: string
}

export interface UpdatedDataPathResp {
  deleted: string[]
  updated: Record<string, DataField>
}

import fs from "fs"
import chalk from "chalk"
import axios from "axios"
import ts, { ModuleKind } from "typescript"
import { Script, createContext } from "vm"
import { getConfig } from "../utils"
import {
  TestConfig,
  dumpTestConfig,
  GenTestEndpoint,
  TestTemplate,
  processResourceConfig,
  parseResourceConfig,
  TemplateConfig,
} from "@metlo/testing"
import * as MetloTesting from "@metlo/testing"
import { TEMPLATES } from "@metlo/testing/dist/templates"
import groupBy from "lodash.groupby"
import { urlJoin } from "./utils"
import { validateTemplateObj } from "./validate"

const TYPE_TO_TEMPLATES = groupBy(TEMPLATES, e => e.name)

export interface GenerateTestRes {
  success: boolean
  msg?: string
  test?: TestConfig
}

const genTestFromFile = (
  path: string,
  endpoint: GenTestEndpoint,
  config: TemplateConfig,
): [TestConfig, string] => {
  if (!fs.existsSync(path)) {
    return [null, chalk.bold.red(`INVALID PATH: "${path}"`)]
  }
  let contents = fs.readFileSync(path, {
    encoding: "utf8",
    flag: "r",
  })
  if (path.endsWith(".ts")) {
    contents = ts.transpile(contents, { module: ModuleKind.CommonJS })
  }

  const sandbox = {
    module: { exports: {} },
    exports: {},
    endpoint,
    config,
    testing: Object.entries(MetloTesting),
    require: function (module) {
      if (module === "@metlo/testing") {
        return MetloTesting
      }
      return require(module)
    },
  }
  const script = new Script(contents)
  const context = createContext(sandbox)
  script.runInContext(context, { timeout: 1000 })
  const template = sandbox.exports
  const err = validateTemplateObj(path, template)
  if (err) {
    return [null, err]
  }

  const resScript = new Script(
    `${contents}\nmodule.exports = exports.default.builder(endpoint, config).getTest();`,
  )
  resScript.runInContext(context)
  const res = sandbox.module.exports

  return [res as TestConfig, ""]
}

const getTestTemplate = (
  test: string,
  version?: number,
): [TestTemplate, string] => {
  const templates = TYPE_TO_TEMPLATES[test.toUpperCase()]
  if (!templates) {
    return [null, `INVALID TEMPLATE: "${test}"`]
  }
  const sortedTemplates = templates.sort((a, b) => b.version - a.version)
  let template = sortedTemplates[0]
  if (version) {
    template = sortedTemplates.find(e => e.version == version)
  }
  if (!template) {
    return [null, `INVALID TEMPLATE - "${test}:${version}"`]
  }
  return [template, ""]
}

export const generateTest = async ({
  path: filePath,
  testType,
  host,
  method,
  endpoint,
  version,
}) => {
  const config = getConfig()
  const res = await axios.get<GenTestEndpoint>(
    urlJoin(config.metloHost, "api/v1/gen-test-endpoint"),
    {
      params: {
        method: method,
        endpoint: endpoint,
        host: host,
      },
      headers: {
        Authorization: config.apiKey,
      },
      validateStatus: () => true,
    },
  )
  if (res.status > 300) {
    console.log(
      chalk.bold.red(
        `Failed to generate test [Code ${res.status}] - ${res.data}`,
      ),
    )
    return
  }
  const genTestEndpoint = res.data

  let testConfigString = null
  try {
    const configStringRes = await axios.get<{ configString: string }>(
      urlJoin(config.metloHost, "api/v1/testing-config"),
      {
        headers: {
          Authorization: config.apiKey,
        },
        validateStatus: () => true,
      },
    )
    if (configStringRes.status > 300) {
      console.log(
        chalk.bold.red(
          `Failed to generate test [Code ${configStringRes.status}] - ${configStringRes.data}`,
        ),
      )
      return
    }
    testConfigString = configStringRes?.data?.configString
  } catch (err) {
    console.log(
      chalk.bold.red(
        `Failed to generate test: Could not retrieve testing config`,
      ),
    )
    return
  }

  let templateConfig = {}
  if (testConfigString) {
    const parseRes = parseResourceConfig(testConfigString)
    if (!parseRes.res) {
      console.log(
        chalk.bold.red(
          `Failed to generate test: ${
            parseRes.parseError?.message ?? "Invalid Testing Config"
          }`,
        ),
      )
    }
    templateConfig = processResourceConfig(parseRes.res)
  }

  let testYaml = ""
  if (testType.endsWith(".js") || testType.endsWith(".ts")) {
    const [test, err] = genTestFromFile(
      testType,
      genTestEndpoint,
      templateConfig as TemplateConfig,
    )
    if (err) {
      console.log(err)
      return
    }
    testYaml = dumpTestConfig(test)
  } else {
    const [template, err] = getTestTemplate(testType, version)
    if (err) {
      console.log(err)
      return
    }
    try {
      const test = template.builder(genTestEndpoint, templateConfig).getTest()
      testYaml = dumpTestConfig(test)
    } catch (err) {
      console.log(chalk.bold.red(`Failed to generate test: ${err?.message}`))
    }
  }

  if (filePath) {
    fs.writeFileSync(filePath, testYaml)
    console.log(
      chalk.bold.green(`Success! Wrote test template to "${filePath}"`),
    )
  } else {
    console.log(testYaml)
  }
}

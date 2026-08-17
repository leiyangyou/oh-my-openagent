import fs from "node:fs"
import http from "node:http"

const port = Number(process.env.FAKE_OPENAI_PORT)
const logFile = process.env.FAKE_LLM_LOG
let callCount = 0
let parentStep = 0
let firstActive = false
let released = false
let secondIssued = false
let heldResponse

function usage() {
  return {
    input_tokens: 10,
    output_tokens: 5,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens_details: { reasoning_tokens: 0 },
  }
}

function sendEvents(response, events) {
  response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" })
  for (const event of events) response.write(`data: ${JSON.stringify(event)}\n\n`)
  response.end("data: [DONE]\n\n")
}

function sendError(response) {
  response.writeHead(429, { "content-type": "application/json" })
  response.end(JSON.stringify({ error: { message: "The usage limit has been reached", type: "usage_limit_reached", code: "usage_limit_reached" } }))
}

function textEvents(text) {
  const responseID = `resp_${callCount}`
  const itemID = `msg_${callCount}`
  return [
    { type: "response.created", response: { id: responseID, created_at: Math.floor(Date.now() / 1000), model: "fake" } },
    { type: "response.output_item.added", output_index: 0, item: { type: "message", id: itemID } },
    { type: "response.output_text.delta", item_id: itemID, output_index: 0, delta: text },
    { type: "response.output_item.done", output_index: 0, item: { type: "message", id: itemID } },
    { type: "response.completed", response: { usage: usage() } },
  ]
}

function toolEvents(args) {
  const responseID = `resp_${callCount}`
  const itemID = `fc_${callCount}`
  const callID = `call_${callCount}`
  const argumentsText = JSON.stringify(args)
  return [
    { type: "response.created", response: { id: responseID, created_at: Math.floor(Date.now() / 1000), model: "fake" } },
    { type: "response.output_item.added", output_index: 0, item: { type: "function_call", id: itemID, call_id: callID, name: "task", arguments: "" } },
    { type: "response.function_call_arguments.delta", item_id: itemID, output_index: 0, delta: argumentsText },
    { type: "response.output_item.done", output_index: 0, item: { type: "function_call", id: itemID, call_id: callID, name: "task", arguments: argumentsText, status: "completed" } },
    { type: "response.completed", response: { usage: usage() } },
  ]
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") return response.writeHead(200).end("ok")
  if (request.method === "GET" && request.url === "/state") {
    response.writeHead(200, { "content-type": "application/json" })
    return response.end(JSON.stringify({ firstActive, released, secondIssued }))
  }
  if (request.method === "POST" && request.url === "/release-first") {
    released = true
    if (heldResponse !== undefined) {
      sendError(heldResponse)
      heldResponse = undefined
    }
    return response.writeHead(200).end("released")
  }
  if (request.method !== "POST" || !request.url?.includes("/responses")) return response.writeHead(404).end()

  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  callCount += 1
  const input = JSON.stringify(body.input ?? body)
  fs.appendFileSync(logFile, JSON.stringify({ call: callCount, model: body.model, input }) + "\n")

  if (input.includes("Generate a title")) return sendEvents(response, textEvents("background admission qa"))
  if (body.model === "parent-base" && input.includes("BGQA_PARENT")) {
    parentStep += 1
    if (parentStep === 1) {
      return sendEvents(response, toolEvents({
        description: "first background admission qa",
        prompt: "BGQA_FIRST_CHILD",
        category: "quick",
        run_in_background: true,
        load_skills: [],
      }))
    }
    if (parentStep === 2) {
      secondIssued = true
      return sendEvents(response, toolEvents({
        description: "second background admission qa",
        prompt: "BGQA_SECOND_CHILD",
        category: "quick",
        run_in_background: true,
        load_skills: [],
      }))
    }
    return sendEvents(response, textEvents("PARENT_DONE"))
  }
  if (body.model === "fallback-old") return sendEvents(response, textEvents("FALLBACK_DONE"))
  if (input.includes("BGQA_FIRST_CHILD")) {
    firstActive = true
    if (released) return sendError(response)
    heldResponse = response
    return
  }
  if (input.includes("BGQA_SECOND_CHILD")) return sendEvents(response, textEvents("SECOND_DONE"))
  return sendEvents(response, textEvents("PARENT_DONE"))
})

server.listen(port, "127.0.0.1", () => process.stdout.write(`listening ${port}\n`))

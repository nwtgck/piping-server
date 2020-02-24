import * as http from "http";
import * as http2 from "http2";

type ClientLog =
  { log_version: 1 } |
  { status: "start_sending", n_receivers: number } |
  { status: "closed_halfway" } |
  { status: "finished" } |
  { status: "waiting_for_receivers", n_rest_receivers: number } |
  { status: "receiver_connected", "n_connected_receivers": number } |
  { error: ClientLogError}
;












type A = Readonly<{ kind: "kind1", name: string } | { kind: "kind2", value: number }>


const a1: A = { kind2: "kind1", name: "john"};















type ClientLogError = Readonly<
  { code: "reserved_path_sending" } |
  { code: "unsupported_http_method" } |
  { code: "sending_failed" } |
  { code: "invalid_n_receivers" } |
  { code: "path_established_already" } |
  { code: "another_sender_connected" } |
  { code: "undesired_n_receivers", desired_n_receivers: number } |
  { code: "service_worker_registration_rejected" } |
  { code: "receiver_limit_reached" }
>;


function humanLogFormatter(log: ClientLog): string | undefined {
  if ("log_version" in log) {
    // Don't tell log version to human
    return undefined;
  } else if("status" in log) {
    const log2: ClientLog = {status: "finished"};
    return log.status;
  } else {
    return log.error.code;
  }
}

function handleLog(logFormatter: (log: ClientLog) => string | undefined, res: http.ServerResponse | http2.Http2ServerResponse): void {
  res.write("");
  res.end();
}

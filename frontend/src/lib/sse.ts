export type ServerSentEvent = { event: string; data: string };

/** Parses a text/event-stream body into events as they arrive. */
export async function* readEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ServerSentEvent> {
  const decoder = new TextDecoderStream() as ReadableWritablePair<string, Uint8Array>;
  const reader = body.pipeThrough(decoder).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value.replace(/\r\n/g, "\n");

      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        let event = "message";
        const data: string[] = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
        }
        if (data.length) yield { event, data: data.join("\n") };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

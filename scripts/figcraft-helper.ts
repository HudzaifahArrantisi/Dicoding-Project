import { spawn } from "child_process";

export let activeClient: FigCraftClient | null = null;

export class FigCraftClient {
  proc: any;
  msgId = 1;
  pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

  async connect() {
    activeClient = this;
    this.proc = spawn("D:/FigCraft/figcraft-cli.exe", ["mcp", "--attach", "7979"]);
    let buffer = "";

    this.proc.stderr?.on("data", (chunk: any) => {
      const msg = chunk.toString();
      if (msg.includes("can't reach") || msg.includes("error")) {
        console.error("FigCraft CLI Error:", msg.trim());
      }
    });

    this.proc.on("exit", (code: number) => {
      for (const { reject } of this.pending.values()) {
        reject(new Error(`FigCraft process exited with code ${code}. Pastikan aplikasi FigCraft sudah dibuka dengan \`figcraft --control 7979\``));
      }
      this.pending.clear();
    });

    this.proc.stdout.on("data", (chunk: any) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id)!;
            this.pending.delete(msg.id);
            if (msg.error) reject(new Error(JSON.stringify(msg.error)));
            else resolve(msg.result);
          }
        } catch (e) {}
      }
    });

    // Timeout guard: 3 seconds
    const initPromise = this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "moodly-builder", version: "1.0.0" },
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Gagal terhubung ke FigCraft di port 7979 (Connection Timeout).\nPastikan aplikasi FigCraft sudah berjalan dengan perintah:\n  D:\\FigCraft\\FigCraft.exe --control 7979"
            )
          ),
        4000
      )
    );

    await Promise.race([initPromise, timeoutPromise]);
  }

  request(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  async callTool(name: string, args: any) {
    const res = await this.request("tools/call", { name, arguments: args });
    if (res.isError) throw new Error(JSON.stringify(res.content));
    const text = res.content?.[0]?.text;
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return res;
  }

  async runCommand(command: string, params: any) {
    return this.callTool("run_command", { command, params });
  }

  async createNode(params: any): Promise<{ id: number; node?: any }> {
    return this.callTool("create_node", params);
  }

  async setProperties(ids: number[], props: any) {
    return this.callTool("set_properties", { ids, props });
  }

  close() {
    if (this.proc) this.proc.kill();
  }
}

export interface FrameOpts {
  x?: number;
  y?: number;
  layout?: "horizontal" | "vertical" | null;
  gap?: number;
  padding?: number | [number, number] | [number, number, number, number];
  fill?: string;
  stroke?: string;
  strokeWeight?: number;
  dashes?: number[];
  cornerRadius?: number | [number, number, number, number];
  sizingH?: "fixed" | "hug" | "fill";
  sizingV?: "fixed" | "hug" | "fill";
  mainAlign?: "min" | "center" | "max" | "spaceBetween" | "spaceAround";
  crossAlign?: "min" | "center" | "max" | "stretch";
  clip?: boolean;
}

export interface TextOpts {
  fontSize?: number;
  fontStyle?: string;
  fontFamily?: string;
  fill?: string;
  textAlign?: "left" | "center" | "right";
  sizingH?: "hug" | "fill";
}

export async function createAutoFrame(
  a: any,
  b: any,
  c: any,
  d?: any,
  e?: any,
  f?: any
) {
  let client: FigCraftClient;
  let parent: number | undefined;
  let name: string;
  let width: number;
  let height: number;
  let opts: FrameOpts;

  if (a && typeof a === "object" && "createNode" in a) {
    client = a;
    parent = b;
    name = c;
    width = d;
    height = e;
    opts = f || {};
  } else {
    client = activeClient!;
    parent = a;
    name = b;
    width = c;
    height = d;
    opts = e || {};
  }

  const layout = opts.layout !== undefined ? opts.layout : "vertical";
  const props: any = {
    name,
    fill: opts.fill || "none",
  };
  if (layout !== null) props.layout = layout;
  if (opts.gap !== undefined) props.gap = opts.gap;
  if (opts.padding !== undefined) props.padding = opts.padding;
  if (opts.stroke) {
    props.stroke = opts.stroke;
    props.strokeWeight = opts.strokeWeight ?? 1;
  }
  if (opts.dashes) props.dashes = opts.dashes;
  if (opts.cornerRadius !== undefined) props.cornerRadius = opts.cornerRadius;
  if (layout !== null) {
    if (opts.sizingH) props.sizingH = opts.sizingH;
    if (opts.sizingV) props.sizingV = opts.sizingV;
    if (opts.mainAlign) props.mainAlign = opts.mainAlign;
    if (opts.crossAlign) props.crossAlign = opts.crossAlign;
  }
  if (opts.clip !== undefined) props.clip = opts.clip;

  const res = await client.createNode({
    type: "frame",
    name,
    parent,
    width,
    height,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    props,
  });
  return res.id;
}

export async function createText(
  a: any,
  b: any,
  c: any,
  d?: any,
  e?: any
) {
  let client: FigCraftClient;
  let parent: number;
  let name: string;
  let text: string;
  let opts: TextOpts;

  if (a && typeof a === "object" && "createNode" in a) {
    client = a;
    parent = b;
    name = c;
    text = d;
    opts = e || {};
  } else {
    client = activeClient!;
    parent = a;
    name = b;
    text = c;
    opts = d || {};
  }

  const props: any = {
    name,
    fontSize: opts.fontSize ?? 13,
    fontFamily: opts.fontFamily ?? "Figtree",
    fontStyle: opts.fontStyle ?? "Regular",
    fill: opts.fill ?? "#141B3D",
  };
  if (opts.textAlign) props.textAlign = opts.textAlign;
  if (opts.sizingH) props.sizingH = opts.sizingH;

  const res = await client.createNode({
    type: "text",
    name,
    parent,
    text,
    props,
  });
  return res.id;
}

export async function createBadge(
  a: FigCraftClient | number,
  b: number | string,
  c: string,
  d: string,
  e?: string | number,
  f?: number
) {
  let client: FigCraftClient;
  let parent: number;
  let label: string;
  let bg: string;
  let textCol: string;
  let fontSize: number = 11;

  if (typeof a === "object" && a !== null) {
    client = a as FigCraftClient;
    parent = b as number;
    label = c;
    bg = d;
    textCol = e as string;
    if (f !== undefined) fontSize = f;
  } else {
    client = activeClient!;
    parent = a as number;
    label = b as string;
    bg = c;
    textCol = d;
    if (typeof e === "number") fontSize = e;
  }

  const frameId = await createAutoFrame(client, parent, `Badge_${label}`, 50, 22, {
    layout: "horizontal",
    padding: [3, 8],
    cornerRadius: 6,
    fill: bg,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "hug",
    sizingV: "hug",
  });
  await createText(client, frameId, `txt_${label}`, label, {
    fontSize,
    fontStyle: "Bold",
    fill: textCol,
  });
  return frameId;
}

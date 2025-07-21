// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as b64decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// 🟢 bundle único, já compatível com o Edge Runtime (Deno v1.45)
import * as pdfjs from "https://esm.sh/pdfjs-dist@3.9.179/legacy/build/pdf.mjs?bundle&target=deno";

// ------------------------------------------------------------
// CORS + TIPOS
// ------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PDFPayload {
  file: string;       // data:application/pdf;base64,....
  filename: string;
  contentType: string; // sempre "application/pdf"
}

// ------------------------------------------------------------
// EDGE FUNCTION
// ------------------------------------------------------------
serve(async (req) => {
  // Pre‑flight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --------------------------------------------------------
    // 1. Ler e validar corpo
    // --------------------------------------------------------
    const { file, filename, contentType } = (await req.json()) as PDFPayload;

    if (!file?.startsWith("data:application/pdf;base64,")) {
      throw new Error("Campo 'file' deve ser um data URI PDF em base64");
    }
    if (contentType !== "application/pdf") {
      throw new Error("Somente PDFs são suportados");
    }

    // --------------------------------------------------------
    // 2. Converter base64 → Uint8Array
    // --------------------------------------------------------
    const base64 = file.split(",", 2)[1];        // remove o prefixo data:
    const pdfData = b64decode(base64);           // Uint8Array

    // --------------------------------------------------------
    // 3. Carregar PDF e extrair texto
    // --------------------------------------------------------
    const loadingTask = pdfjs.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;

    let text = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const { items } = await page.getTextContent();
      text += items.map((i: any) => i.str).join(" ") + "\n";
    }

    // --------------------------------------------------------
    // 4. Responder
    // --------------------------------------------------------
    return new Response(
      JSON.stringify({
        filename,
        pages: pdf.numPages,
        // exemplo simples – você pode mudar para o formato que precisar
        text,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      },
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Erro inesperado" }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      },
    );
  }
});

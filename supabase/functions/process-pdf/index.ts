// --------------------------------
// IMPORTS
// --------------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as b64decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { extractText } from "https://deno.land/x/unpdf@0.6.0/mod.ts";   // 🆕

// --------------------------------
// CORS + TIPOS (iguais)
// --------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PDFData {
  file: string;       // base‑64 (apenas os caracteres, sem prefixo)
  filename: string;
  contentType: string;
}

// --------------------------------
// FUNÇÃO PRINCIPAL
// --------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file, filename, contentType } = (await req.json()) as PDFData;

    // 1️⃣ validação
    if (!file) throw new Error("Nenhum arquivo foi recebido");
    if (contentType !== "application/pdf") throw new Error("Apenas PDF é suportado");

    // 2️⃣ extração de texto ─ retorna **string**
    const pdfText = await extractTextFromPDF(file);

    // 3️⃣ parse
    const itensExtraídos = parseBoletimMedicao(pdfText);

    return new Response(
      JSON.stringify({ mensagem: "OK", itens: itensExtraídos }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --------------------------------
// UTILITÁRIOS
// --------------------------------
async function extractTextFromPDF(base64: string): Promise<string> {
  // remove quebras de linha que vêm do certutil / linux base64
  base64 = base64.replace(/\s+/g, "");
  const bytes = b64decode(base64);
  const { text } = await extractText(bytes); // unpdf devolve objeto { text }
  return String(text);                       // <- garante string
}

function parseBoletimMedicao(textoIn: unknown) {
  const texto = String(textoIn ?? "");
  if (!texto.trim()) throw new Error("PDF sem texto extraído");

  const linhas = texto.split("\n");
  /* ... resto do seu parser ... */
  return []; // placeholder
}

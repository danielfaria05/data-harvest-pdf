//------------------------------------------------
// IMPORTS
//------------------------------------------------
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as b64decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { extractText } from "https://esm.sh/unpdf@0.7.1?dts";

//------------------------------------------------
// CORS + TIPOS (iguais)
//------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PDFData {
  file: string;
  filename: string;
  contentType: string;
}

interface ExtractedItem {
  num_solicitacao: string;
  seq: number;
  codigo: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

//------------------------------------------------
// HANDLER
//------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file, filename, contentType }: PDFData = await req.json();
    if (contentType !== "application/pdf") throw new Error("Arquivo não é PDF");

    // 1) base64 -> bytes
    const bytes = b64decode(file.includes(",") ? file.split(",")[1] : file);

    // 2) extrai TODO o texto usando unpdf (1 linha!)
    const pdfText = await extractText(bytes);

    // 3) seu parser
    const itens = parseBoletimMedicao(pdfText);
    if (!itens.length) throw new Error("Nenhum item encontrado no PDF");

    // 4) resumo (mesma lógica de antes)
    const totalItems = itens.length;
    const totalValue = itens.reduce((s, i) => s + i.valor_total, 0);
    const solicitacoes = [...new Set(itens.map((i) => i.num_solicitacao))].map(
      (n) => +n,
    );
    solicitacoes.sort((a, b) => a - b);

    return new Response(
      JSON.stringify({
        extracted_items: itens,
        summary: {
          quantidade_total_itens: totalItems,
          valor_total_extraido: totalValue,
          total_solicitacoes: solicitacoes.length,
          range_solicitacoes: `${solicitacoes[0]} - ${
            solicitacoes[solicitacoes.length - 1]
          }`,
          arquivo_processado: filename,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

//------------------------------------------------
// PARSER (igual ao seu)
//------------------------------------------------
function parseBoletimMedicao(texto: string): ExtractedItem[] {
  const linhas = texto.split("\n");
  const itens: ExtractedItem[] = [];

  let numSolic = "";
  let esperandoQtd = false;
  let parcial: any = null;

  for (const l of linhas.map((x) => x.trim())) {
    if (l.startsWith("Nº Solicitação:")) {
      const m = l.match(/Nº Solicitação:\s*(\d{3}\.\d{3})/);
      if (m) numSolic = m[1];
    }

    const mItem = l.match(/^(\d+)\s+(\d{9})\s+-\s+(.*?)\s+UN\s+([\d,.]+)/);
    if (mItem) {
      parcial = {
        num_solicitacao: numSolic,
        seq: +mItem[1],
        codigo: mItem[2],
        valor_unitario: parseFloat(mItem[4].replace(".", "").replace(",", ".")),
      };
      esperandoQtd = true;
      continue;
    }

    if (esperandoQtd && /^\d+,\d{5}$/.test(l)) {
      const quantidade = parseFloat(l.replace(".", "").replace(",", "."));
      itens.push({
        ...parcial,
        quantidade,
        valor_total: +(quantidade * parcial.valor_unitario).toFixed(6),
      });
      esperandoQtd = false;
    }
  }

  return itens;
}

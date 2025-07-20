// supabase/functions/process-pdf/index.ts
//------------------------------------------------
// IMPORTS
//------------------------------------------------
import { serve } from "https://deno.land/std@0.204.0/http/server.ts";
import { PDFDocument } from "https://deno.land/x/pdf@0.5.0/mod.ts";
import { decode as b64decode } from "https://deno.land/std@0.204.0/encoding/base64.ts";

//------------------------------------------------
// CORS + TIPOS
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
// HANDLER HTTP
//------------------------------------------------
serve(async (req) => {
  // pré‑flight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file, filename, contentType }: PDFData = await req.json();

    // validações básicas
    if (contentType !== "application/pdf") {
      throw new Error("Apenas arquivos PDF são suportados");
    }
    if (!file) {
      throw new Error("Nenhum arquivo foi recebido");
    }

    // 1) extrai texto com deno_pdf
    const pdfText = await extractTextFromPDF(file);

    // 2) aplica parser dos boletins
    const extractedItems = parseBoletimMedicao(pdfText);
    if (extractedItems.length === 0) {
      throw new Error(
        "Nenhum item foi encontrado no PDF. Verifique o formato do Boletim de Medição.",
      );
    }

    // 3) estatísticas/resumo
    const totalItems = extractedItems.length;
    const totalValue = extractedItems.reduce(
      (sum, item) => sum + item.valor_total,
      0,
    );
    const uniqueSolicitations = new Set(
      extractedItems.map((i) => i.num_solicitacao),
    ).size;

    const solicitationNumbers = Array.from(
      new Set(extractedItems.map((i) => parseInt(i.num_solicitacao))),
    ).sort((a, b) => a - b);
    const minSolicitation = solicitationNumbers[0];
    const maxSolicitation = solicitationNumbers[solicitationNumbers.length - 1];

    // 4) resposta
    return new Response(
      JSON.stringify({
        extracted_items: extractedItems,
        summary: {
          quantidade_total_itens: totalItems,
          valor_total_extraido: totalValue,
          total_solicitacoes: uniqueSolicitations,
          range_solicitacoes: `${minSolicitation} - ${maxSolicitation}`,
          arquivo_processado: filename,
        },
        mensagem:
          `Extração realizada com sucesso. ${totalItems} itens encontrados em ${uniqueSolicitations} solicitações (${minSolicitation} a ${maxSolicitation}).`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({
        error: msg,
        details: err instanceof Error ? err.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

//------------------------------------------------
// FUNÇÃO: extrai texto usando deno_pdf
//------------------------------------------------
async function extractTextFromPDF(base64File: string): Promise<string> {
  // remove prefixo data URI, se existir
  const cleanB64 = base64File.includes(",") ? base64File.split(",")[1] : base64File;
  const bytes = b64decode(cleanB64); // Uint8Array

  const pdf = await PDFDocument.load(bytes);
  let fullText = "";

  // percorre páginas
  for (const pageIndex of pdf.getPageIndices()) {
    const page = await pdf.getPage(pageIndex);
    const { items } = await page.getTextContent();
    fullText += items.map((it: any) => it.str).join("\n") + "\n";
  }

  // limpeza leve: remove controles duplicados e espaços extras
  return fullText
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

//------------------------------------------------
// PARSER Boletim de Medição (mantido)
//------------------------------------------------
function parseBoletimMedicao(texto: string): ExtractedItem[] {
  const linhas = texto.split("\n");
  const itens: ExtractedItem[] = [];

  let numSolicitacaoAtual = "";
  let aguardandoQtd = false;
  let dadosParciais: any = null;

  for (const linhaOriginal of linhas) {
    const linha = linhaOriginal.trim();

    // Nº da solicitação
    if (linha.startsWith("Nº Solicitação:")) {
      const match = linha.match(/Nº Solicitação:\s*(\d{3}\.\d{3})/);
      if (match) numSolicitacaoAtual = match[1];
    }

    // linha com Seq / Código / Descrição / Valor Unit
    const mItem = linha.match(/^(\d+)\s+(\d{9})\s+-\s+(.*?)\s+UN\s+([\d,.]+)/);
    if (mItem) {
      dadosParciais = {
        num_solicitacao: numSolicitacaoAtual,
        seq: parseInt(mItem[1]),
        codigo: mItem[2],
        valor_unitario: parseFloat(mItem[4].replace(".", "").replace(",", ".")),
      };
      aguardandoQtd = true;
      continue;
    }

    // linha seguinte: quantidade
    if (aguardandoQtd && /^\d+,\d{5}$/.test(linha)) {
      const quantidade = parseFloat(linha.replace(".", "").replace(",", "."));
      const valor_total = parseFloat(
        (quantidade * dadosParciais.valor_unitario).toFixed(6),
      );

      itens.push({
        ...dadosParciais,
        quantidade,
        valor_total,
      });

      aguardandoQtd = false;
      dadosParciais = null;
    }
  }

  return itens;
}

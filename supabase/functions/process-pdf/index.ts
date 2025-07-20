import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('PDF processing started');
    
    const requestBody = await req.json();
    console.log('Request received with keys:', Object.keys(requestBody));
    
    const { file, filename, contentType }: PDFData = requestBody;
    
    console.log(`Processing file: ${filename}, type: ${contentType}`);

    // Validate PDF
    if (contentType !== 'application/pdf') {
      console.error('Invalid file type:', contentType);
      throw new Error('Apenas arquivos PDF são suportados');
    }

    if (!file) {
      console.error('No file data received');
      throw new Error('Nenhum arquivo foi recebido');
    }

    console.log('File validation passed, starting PDF text extraction...');

    // Extract text from PDF
    const pdfText = await extractTextFromPDF(file);
    console.log('PDF text extracted, length:', pdfText.length);
    
    // Parse extracted text to find items
    const extractedItems = parseBoletimMedicao(pdfText);
    
    console.log(`Extracted ${extractedItems.length} items from PDF`);

    if (extractedItems.length === 0) {
      console.warn('No items extracted from PDF');
      throw new Error('Nenhum item foi encontrado no PDF. Verifique se o PDF contém dados no formato esperado de Boletim de Medição.');
    }

    // Calculate summary statistics
    const totalItems = extractedItems.length;
    const totalValue = extractedItems.reduce((sum, item) => sum + item.valor_total, 0);
    const uniqueSolicitations = new Set(extractedItems.map(item => item.num_solicitacao)).size;
    
    // Get solicitation range
    const solicitationNumbers = Array.from(new Set(extractedItems.map(item => item.num_solicitacao)))
      .map(num => parseInt(num))
      .sort((a, b) => a - b);
    
    const minSolicitation = solicitationNumbers[0];
    const maxSolicitation = solicitationNumbers[solicitationNumbers.length - 1];

    console.log('Extraction completed successfully');
    console.log(`Summary: ${totalItems} items, ${uniqueSolicitations} solicitations (${minSolicitation} to ${maxSolicitation}), total value: ${totalValue}`);
    
    return new Response(JSON.stringify({
      extracted_items: extractedItems,
      summary: {
        quantidade_total_itens: totalItems,
        valor_total_extraido: totalValue,
        total_solicitacoes: uniqueSolicitations,
        range_solicitacoes: `${minSolicitation} - ${maxSolicitation}`,
        arquivo_processado: filename
      },
      mensagem: `Extração realizada com sucesso. ${totalItems} itens encontrados em ${uniqueSolicitations} solicitações (${minSolicitation} a ${maxSolicitation}).`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-pdf function:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Returning error response:', errorMessage);
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: error instanceof Error ? error.stack : 'No stack trace available'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Extract text from PDF using simple byte pattern analysis
async function extractTextFromPDF(base64File: string): Promise<string> {
  console.log('Starting PDF text extraction...');
  
  try {
    // Convert base64 to bytes
    const binaryString = atob(base64File);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('PDF file size:', bytes.length, 'bytes');
    
    // Convert to string and extract readable text
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let rawText = decoder.decode(bytes);
    
    // More aggressive text cleaning for PDF extraction
    let cleanText = rawText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ') // Remove control chars
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s\d\.,\-\(\)\/\:]/g, ' ') // Keep only alphanumeric and common symbols
      .trim();
    
    console.log('Extracted text length:', cleanText.length);
    
    // Log first 500 chars to debug format
    console.log('First 500 chars of extracted text:', cleanText.substring(0, 500));
    
    // Look for common patterns that might indicate table data
    const hasNumbers = /\d{3,}/.test(cleanText);
    const hasSequences = /\d+\s+\d{7,}/.test(cleanText);
    console.log('Text analysis - Has long numbers:', hasNumbers, 'Has sequences:', hasSequences);
    
    return cleanText;
    
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Erro ao extrair texto do PDF');
  }
}

// NOVO PARSER SUBSTITUINDO O ANTIGO
function parseBoletimMedicao(texto: string): ExtractedItem[] {
  const linhas = texto.split('\n');
  const itens: ExtractedItem[] = [];

  let numSolicitacaoAtual = '';
  let linhaAnterior = '';
  let linhaDoItem = '';
  let aguardandoQtd = false;
  let dadosParciais: any = null;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();

    // Captura o número da solicitação
    if (linha.startsWith('Nº Solicitação:')) {
      const match = linha.match(/Nº Solicitação:\s*(\d{3}\.\d{3})/);
      if (match) {
        numSolicitacaoAtual = match[1];
      }
    }

    // Captura a linha com: Seq Código Descrição Valor Unitário
    const linhaItem = linha.match(/^(\d+)\s+(\d{9})\s+-\s+(.*?)\s+UN\s+([\d,.]+)/);
    if (linhaItem) {
      linhaDoItem = linha;
      dadosParciais = {
        num_solicitacao: numSolicitacaoAtual,
        seq: parseInt(linhaItem[1]),
        codigo: linhaItem[2],
        valor_unitario: parseFloat(linhaItem[4].replace('.', '').replace(',', '.')),
      };
      aguardandoQtd = true;
      continue;
    }

    // Captura a quantidade na linha abaixo de "Descrição Detalhada:"
    if (aguardandoQtd && /^\d+,\d{5}$/.test(linha)) {
      const quantidade = parseFloat(linha.replace('.', '').replace(',', '.'));
      const valor_total = parseFloat((quantidade * dadosParciais.valor_unitario).toFixed(6));

      itens.push({
        ...dadosParciais,
        quantidade,
        valor_total,
      });

      aguardandoQtd = false;
      dadosParciais = null;
    }

    linhaAnterior = linha;
  }

  return itens;
}

// As demais funções (extractPickLojaItems, extractWithIntelligentAnalysis, etc.) permanecem no arquivo original,
// mas não são usadas pelo novo parser. Se quiser remover para deixar mais limpo, pode apagar abaixo desta linha!

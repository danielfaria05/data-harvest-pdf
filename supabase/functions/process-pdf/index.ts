
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

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

    console.log('File validation passed, starting extraction...');

    // Extract data from PDF - now with real PDF processing
    const extractedItems: ExtractedItem[] = await extractFromPDF(file, filename);
    
    console.log(`Extracted ${extractedItems.length} items from PDF`);

    if (extractedItems.length === 0) {
      console.warn('No items extracted from PDF');
      throw new Error('Nenhum item foi encontrado no PDF. Verifique se o PDF contém dados no formato esperado.');
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

// Real PDF extraction function using PDF.js (Deno-compatible)
async function extractFromPDF(base64File: string, filename: string): Promise<ExtractedItem[]> {
  console.log('Starting real PDF extraction for:', filename);
  
  try {
    // Convert base64 to Uint8Array
    const binaryString = atob(base64File);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('PDF file converted to bytes, size:', bytes.length);
    
    // Import PDF.js from CDN (Deno-compatible)
    const pdfjsLib = await import('https://cdn.skypack.dev/pdfjs-dist@3.11.174/build/pdf.min.js');
    
    // Set worker source to prevent worker issues in Deno
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.skypack.dev/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    
    console.log('PDF.js library loaded, parsing document...');
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    
    console.log(`PDF loaded successfully. Number of pages: ${pdf.numPages}`);
    
    let fullText = '';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`Processing page ${pageNum}/${pdf.numPages}...`);
      
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items into a single string
      const pageText = textContent.items
        .filter((item: any) => item.str && item.str.trim())
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
    }
    
    console.log('PDF text extraction completed, total text length:', fullText.length);
    
    // Extract items from the text
    const extractedItems = parseTextForItems(fullText);
    
    console.log(`Parsing completed. Found ${extractedItems.length} items`);
    
    return extractedItems;
    
  } catch (error) {
    console.error('Error in PDF extraction:', error);
    
    // If PDF parsing fails, provide detailed error
    if (error instanceof Error) {
      throw new Error(`Erro ao processar PDF: ${error.message}. Verifique se o arquivo não está corrompido.`);
    }
    
    throw new Error('Erro desconhecido ao processar o PDF');
  }
}

// Parse extracted text to find solicitations and items
function parseTextForItems(text: string): ExtractedItem[] {
  console.log('Starting text parsing for items...');
  
  const items: ExtractedItem[] = [];
  
  // Patterns for extraction
  const solicitationPattern = /Nº\s+Solicitação:\s*(\d+)/gi;
  const tableHeaderPattern = /Seq\.\s+PRODUTO\s+UNI\s+MED\.\s+QTD\s+VALOR/gi;
  
  // Find all solicitations
  const solicitations: Array<{num: string, startIndex: number}> = [];
  let match;
  
  while ((match = solicitationPattern.exec(text)) !== null) {
    solicitations.push({
      num: match[1],
      startIndex: match.index
    });
  }
  
  console.log(`Found ${solicitations.length} solicitations:`, solicitations.map(s => s.num));
  
  // Process each solicitation
  for (let i = 0; i < solicitations.length; i++) {
    const currentSolicitation = solicitations[i];
    const nextSolicitationStart = i < solicitations.length - 1 ? solicitations[i + 1].startIndex : text.length;
    
    // Extract text section for this solicitation
    const sectionText = text.substring(currentSolicitation.startIndex, nextSolicitationStart);
    
    console.log(`Processing solicitation ${currentSolicitation.num}...`);
    
    // Find table data in this section
    const sectionItems = extractItemsFromSection(sectionText, currentSolicitation.num);
    items.push(...sectionItems);
    
    console.log(`Found ${sectionItems.length} items in solicitation ${currentSolicitation.num}`);
  }
  
  return items;
}

function extractItemsFromSection(sectionText: string, solicitationNum: string): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  
  // Pattern to match table rows with item data
  // Looking for: number (seq) + 9-digit code + quantity + value
  const itemPattern = /(\d+)\s+(\d{9})\s+[\w\s]+\s+([\d,\.]+)\s+R\$\s*([\d,\.]+)/gi;
  
  let match;
  let sequenceCounter = 1;
  
  while ((match = itemPattern.exec(sectionText)) !== null) {
    try {
      const codigo = match[2];
      const quantidadeStr = match[3].replace(/\./g, '').replace(',', '.');
      const valorTotalStr = match[4].replace(/\./g, '').replace(',', '.');
      
      const quantidade = parseFloat(quantidadeStr);
      const valorTotal = parseFloat(valorTotalStr);
      const valorUnitario = quantidade > 0 ? valorTotal / quantidade : 0;
      
      // Validate extracted data
      if (codigo && !isNaN(quantidade) && !isNaN(valorTotal) && quantidade > 0 && valorTotal > 0) {
        items.push({
          num_solicitacao: solicitationNum,
          seq: sequenceCounter++,
          codigo: codigo,
          quantidade: quantidade,
          valor_unitario: valorUnitario,
          valor_total: valorTotal
        });
        
        console.log(`Extracted item: ${codigo}, qty: ${quantidade}, total: R$ ${valorTotal.toFixed(2)}`);
      }
    } catch (error) {
      console.warn('Error parsing item data:', error);
      continue;
    }
  }
  
  return items;
}

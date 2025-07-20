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
    
    // Clean up the text - remove PDF control characters and keep readable content
    let cleanText = rawText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ') // Remove control chars except \n, \t, \r
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    console.log('Extracted text length:', cleanText.length);
    
    return cleanText;
    
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Erro ao extrair texto do PDF');
  }
}

// Parse Boletim de Medição text to extract structured data
function parseBoletimMedicao(text: string): ExtractedItem[] {
  console.log('Starting Boletim de Medição parsing...');
  
  const items: ExtractedItem[] = [];
  
  // Patterns to identify solicitation numbers and items
  const solicitationPatterns = [
    /(?:Solicitação|solicitação|SOLICITAÇÃO)[\s:]*(\d+)/gi,
    /(?:Nº|N°|No\.|Numero)[\s]*(?:Solicitação|solicitação)[\s:]*(\d+)/gi,
    /(?:Sol|SOL)[\s:]*(\d+)/gi
  ];
  
  // Find all solicitation numbers in the text
  const solicitations: Array<{num: string, index: number}> = [];
  
  for (const pattern of solicitationPatterns) {
    let match;
    pattern.lastIndex = 0; // Reset regex
    while ((match = pattern.exec(text)) !== null) {
      solicitations.push({
        num: match[1],
        index: match.index
      });
    }
  }
  
  // Remove duplicates and sort by position
  const uniqueSolicitations = solicitations
    .filter((sol, index, arr) => 
      arr.findIndex(s => s.num === sol.num) === index
    )
    .sort((a, b) => a.index - b.index);
  
  console.log('Found solicitations:', uniqueSolicitations.map(s => s.num));
  
  // Process each solicitation section
  for (let i = 0; i < uniqueSolicitations.length; i++) {
    const currentSol = uniqueSolicitations[i];
    const nextSol = uniqueSolicitations[i + 1];
    
    // Extract text section for this solicitation
    const startIndex = currentSol.index;
    const endIndex = nextSol ? nextSol.index : text.length;
    const sectionText = text.substring(startIndex, endIndex);
    
    console.log(`Processing solicitation ${currentSol.num}, section length: ${sectionText.length}`);
    
    // Extract items from this section
    const sectionItems = extractItemsFromSection(sectionText, currentSol.num);
    items.push(...sectionItems);
    
    console.log(`Found ${sectionItems.length} items in solicitation ${currentSol.num}`);
  }
  
  return items;
}

function extractItemsFromSection(sectionText: string, solicitationNum: string): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  
  // Multiple patterns to catch different table formats
  const itemPatterns = [
    // Pattern 1: Seq + 9-digit code + description + quantity + unit value + total value
    /(\d{1,3})\s+(\d{9})\s+[^\d]+?\s+([\d,\.]+)\s+[^\d]*?([\d,\.]+)\s+[^\d]*?([\d,\.]+)/gi,
    
    // Pattern 2: Looking for sequences of numbers that might be product data
    /(\d{1,3})\s+(\d{8,12})\s+.+?\s+([\d,\.]+)\s+.+?\s+([\d,\.]+)\s+.+?\s+([\d,\.]+)/gi,
    
    // Pattern 3: More flexible pattern for any sequence-code-values combination
    /(\d{1,3})\s+(\d{7,12})\s+.{10,100}?\s+([\d,\.]+)\s+.{0,20}?\s*([\d,\.]+)\s+.{0,20}?\s*([\d,\.]+)/gi
  ];
  
  let sequenceCounter = 1;
  
  for (const pattern of itemPatterns) {
    let match;
    pattern.lastIndex = 0; // Reset regex
    
    while ((match = pattern.exec(sectionText)) !== null) {
      try {
        const seq = parseInt(match[1]);
        const codigo = match[2];
        
        // Parse numeric values, handling Brazilian number format
        const quantidadeStr = match[3].replace(/\./g, '').replace(',', '.');
        const valorUnitarioStr = match[4] ? match[4].replace(/\./g, '').replace(',', '.') : '0';
        const valorTotalStr = match[5] ? match[5].replace(/\./g, '').replace(',', '.') : '0';
        
        const quantidade = parseFloat(quantidadeStr);
        let valorUnitario = parseFloat(valorUnitarioStr);
        let valorTotal = parseFloat(valorTotalStr);
        
        // If unit value is missing, calculate it
        if (valorUnitario === 0 && valorTotal > 0 && quantidade > 0) {
          valorUnitario = valorTotal / quantidade;
        }
        
        // If total value is missing, calculate it
        if (valorTotal === 0 && valorUnitario > 0 && quantidade > 0) {
          valorTotal = valorUnitario * quantidade;
        }
        
        // Validate extracted data
        if (codigo && codigo.length >= 7 && 
            !isNaN(quantidade) && quantidade > 0 && 
            !isNaN(valorTotal) && valorTotal > 0) {
          
          // Check if we already have this item (avoid duplicates)
          const existingItem = items.find(item => 
            item.codigo === codigo && item.num_solicitacao === solicitationNum
          );
          
          if (!existingItem) {
            items.push({
              num_solicitacao: solicitationNum,
              seq: sequenceCounter++,
              codigo: codigo,
              quantidade: quantidade,
              valor_unitario: valorUnitario,
              valor_total: valorTotal
            });
            
            console.log(`Extracted item: Sol ${solicitationNum}, Code ${codigo}, Qty ${quantidade}, Total R$ ${valorTotal.toFixed(2)}`);
          }
        }
      } catch (error) {
        console.warn('Error parsing item data:', error);
        continue;
      }
    }
    
    // If we found items with this pattern, don't try other patterns for this section
    if (items.length > 0) {
      break;
    }
  }
  
  return items;
}

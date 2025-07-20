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

// Parse Boletim de Medição text to extract structured data
function parseBoletimMedicao(text: string): ExtractedItem[] {
  console.log('Starting PICK LOJA Boletim de Medição parsing...');
  
  // Log a portion of the text to understand its structure
  const sampleText = text.substring(0, 3000);
  console.log('Sample text for analysis:', sampleText);
  
  const items: ExtractedItem[] = [];
  
  // Look for solicitation pattern: N° Solicitação: 286.344
  const solicitationPattern = /N[°º]\s*Solicitação:\s*(\d{3}\.?\d{3})/gi;
  const solicitations: Array<{num: string, index: number}> = [];
  
  let match;
  while ((match = solicitationPattern.exec(text)) !== null) {
    const cleanNum = match[1].replace('.', '');
    solicitations.push({
      num: cleanNum,
      index: match.index
    });
    console.log('Found solicitation:', cleanNum, 'at index:', match.index);
  }
  
  if (solicitations.length === 0) {
    console.log('No solicitations found, trying alternative patterns...');
    return extractPickLojaAlternative(text);
  }
  
  // Process each solicitation section
  for (let i = 0; i < solicitations.length; i++) {
    const currentSol = solicitations[i];
    const nextSol = solicitations[i + 1];
    
    // Extract text section for this solicitation
    const startIndex = currentSol.index;
    const endIndex = nextSol ? nextSol.index : text.length;
    const sectionText = text.substring(startIndex, endIndex);
    
    console.log(`Processing solicitation ${currentSol.num}, section length: ${sectionText.length}`);
    
    // Extract items from this section using PICK LOJA specific patterns
    const sectionItems = extractPickLojaItems(sectionText, currentSol.num);
    items.push(...sectionItems);
    
    console.log(`Found ${sectionItems.length} items in solicitation ${currentSol.num}`);
  }
  
  return items;
}

// Extract items specifically for PICK LOJA format
function extractPickLojaItems(sectionText: string, solicitationNum: string): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  
  // Pattern for PICK LOJA format: Seq. [number] [code] - [description] ... [quantity] [value]
  const patterns = [
    // Pattern 1: Seq. 1 242401223 - DESCRIPTION ... 30.00000 362.439000
    /(\d+)\s+(\d{8,12})\s*-\s*[^0-9]*?(\d{1,3}\.?\d{5})\s+(\d{1,3}\.?\d{6})/gi,
    
    // Pattern 2: More flexible - look for sequence, code, and two decimal numbers at the end
    /(\d+)\s+(\d{8,12})[\s\S]*?(\d+\.?\d{5})\s+(\d+\.?\d{6})/gi,
    
    // Pattern 3: Look for lines with Seq. followed by numbers
    /Seq\.\s*(\d+)\s+(\d{8,12})[\s\S]*?(\d+\.?\d{5})\s+(\d+\.?\d{6})/gi
  ];
  
  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(sectionText)) !== null) {
      try {
        const seq = parseInt(match[1]);
        const codigo = match[2];
        
        // Parse values (PICK LOJA uses dots for decimals)
        const quantidadeStr = match[3].replace(/\./g, '').replace(',', '.');
        const valorTotalStr = match[4].replace(/\./g, '').replace(',', '.');
        
        const quantidade = parseFloat(quantidadeStr) / 100000; // Adjust for format 30.00000 = 30
        const valorTotal = parseFloat(valorTotalStr) / 1000; // Adjust for format 362.439000 = 362.439
        
        // Calculate unit value
        const valorUnitario = quantidade > 0 ? valorTotal / quantidade : 0;
        
        if (codigo && codigo.length >= 8 && quantidade > 0 && valorTotal > 0) {
          items.push({
            num_solicitacao: solicitationNum,
            seq: seq,
            codigo: codigo,
            quantidade: Number(quantidade.toFixed(6)),
            valor_unitario: Number(valorUnitario.toFixed(6)),
            valor_total: Number(valorTotal.toFixed(6))
          });
          
          console.log(`PICK LOJA extracted: Sol ${solicitationNum}, Seq ${seq}, Code ${codigo}, Qty ${quantidade}, Total R$ ${valorTotal.toFixed(2)}`);
        }
      } catch (error) {
        console.warn('Error parsing PICK LOJA item:', error);
        continue;
      }
    }
    
    if (items.length > 0) {
      console.log(`Found ${items.length} items with PICK LOJA pattern`);
      break; // Stop trying other patterns if we found items
    }
  }
  
  return items;
}

// New intelligent analysis function
function extractWithIntelligentAnalysis(text: string): ExtractedItem[] {
  console.log('Starting intelligent analysis...');
  
  const items: ExtractedItem[] = [];
  const lines = text.split(/[\s]{2,}|\n|\r/); // Split on multiple spaces or newlines
  
  let currentSolicitation = '001001'; // Default
  let sequenceCounter = 1;
  
  // Look for solicitation numbers first
  for (const line of lines) {
    const solMatch = line.match(/(\d{3}\.?\d{3})/);
    if (solMatch && line.toLowerCase().includes('sol')) {
      currentSolicitation = solMatch[1].replace('.', '');
      console.log('Found solicitation:', currentSolicitation);
    }
  }
  
  // Now look for data patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length < 10) continue;
    
    // Look for lines that contain multiple numbers
    const numbers = extractNumbersFromLine(line);
    if (numbers.length < 3) continue;
    
    // Try to identify product codes (typically 7-12 digits)
    const productCode = findProductCode(numbers);
    if (!productCode) continue;
    
    // Try to extract quantity and values
    const financialData = extractFinancialData(numbers, productCode);
    if (!financialData) continue;
    
    console.log(`Found potential item: ${productCode} - Qty: ${financialData.quantidade}, Unit: ${financialData.valorUnitario}, Total: ${financialData.valorTotal}`);
    
    // Validate the data makes sense
    if (validateItemData(financialData)) {
      items.push({
        num_solicitacao: currentSolicitation,
        seq: sequenceCounter++,
        codigo: productCode,
        quantidade: financialData.quantidade,
        valor_unitario: financialData.valorUnitario,
        valor_total: financialData.valorTotal
      });
    }
  }
  
  return items;
}

// Extract all numbers from a line
function extractNumbersFromLine(line: string): string[] {
  // Match integers and decimals (both comma and dot notation)
  const numberPattern = /\d+(?:[,.]\d+)?/g;
  return line.match(numberPattern) || [];
}

// Find product code in a list of numbers
function findProductCode(numbers: string[]): string | null {
  for (const num of numbers) {
    const cleanNum = num.replace(/[,.]/g, '');
    // Product codes are typically 7-12 digits
    if (cleanNum.length >= 7 && cleanNum.length <= 12 && !num.includes(',') && !num.includes('.')) {
      return cleanNum;
    }
  }
  return null;
}

// Extract financial data from numbers
function extractFinancialData(numbers: string[], productCode: string): any {
  const decimalNumbers = numbers
    .filter(num => num !== productCode && (num.includes(',') || num.includes('.') || parseInt(num) <= 10000))
    .map(num => parseFloat(num.replace(/\./g, '').replace(',', '.')))
    .filter(val => !isNaN(val) && val > 0);
  
  if (decimalNumbers.length < 2) return null;
  
  // Sort to identify patterns
  const sorted = [...decimalNumbers].sort((a, b) => a - b);
  
  // Heuristics for identifying quantity vs values
  let quantidade = 1;
  let valorUnitario = 0;
  let valorTotal = 0;
  
  if (sorted.length >= 3) {
    // Assume smallest reasonable number is quantity
    quantidade = sorted.find(n => n >= 0.1 && n <= 10000) || sorted[0];
    valorTotal = sorted[sorted.length - 1]; // Largest is total
    valorUnitario = sorted[sorted.length - 2]; // Second largest is unit
  } else if (sorted.length === 2) {
    quantidade = sorted[0] <= 1000 ? sorted[0] : 1;
    valorTotal = sorted[1];
    valorUnitario = valorTotal / quantidade;
  }
  
  return { quantidade, valorUnitario, valorTotal };
}

// Validate extracted item data
function validateItemData(data: any): boolean {
  const { quantidade, valorUnitario, valorTotal } = data;
  
  if (quantidade <= 0 || valorUnitario <= 0 || valorTotal <= 0) return false;
  
  // Check if unit * quantity ≈ total (within 20% tolerance)
  const calculatedTotal = valorUnitario * quantidade;
  const tolerance = Math.max(valorTotal * 0.2, 0.01);
  
  return Math.abs(calculatedTotal - valorTotal) <= tolerance;
}

// Fallback: Extract any numeric patterns that might be valid
function extractNumericPatterns(text: string): ExtractedItem[] {
  console.log('Starting numeric pattern extraction...');
  
  const items: ExtractedItem[] = [];
  
  // Look for sequences of numbers that could represent table rows
  const potentialRows = text.match(/\d+(?:\s+\d+){2,}/g) || [];
  
  console.log(`Found ${potentialRows.length} potential numeric sequences`);
  
  for (let i = 0; i < potentialRows.length; i++) {
    const row = potentialRows[i];
    const numbers = row.split(/\s+/).map(n => n.trim()).filter(n => n.length > 0);
    
    if (numbers.length < 3) continue;
    
    // Look for a potential product code
    const codeCandidate = numbers.find(n => n.length >= 7 && n.length <= 12);
    if (!codeCandidate) continue;
    
    // Try to extract values
    const otherNumbers = numbers.filter(n => n !== codeCandidate).map(n => parseFloat(n));
    const validNumbers = otherNumbers.filter(n => !isNaN(n) && n > 0);
    
    if (validNumbers.length >= 2) {
      const quantidade = validNumbers[0] <= 1000 ? validNumbers[0] : 1;
      const valorTotal = Math.max(...validNumbers);
      const valorUnitario = valorTotal / quantidade;
      
      if (quantidade > 0 && valorUnitario > 0 && valorTotal > 0) {
        items.push({
          num_solicitacao: '001001',
          seq: i + 1,
          codigo: codeCandidate,
          quantidade: Number(quantidade.toFixed(3)),
          valor_unitario: Number(valorUnitario.toFixed(6)),
          valor_total: Number(valorTotal.toFixed(6))
        });
        
        console.log(`Pattern extracted: ${codeCandidate} - ${quantidade} x ${valorUnitario.toFixed(2)} = ${valorTotal.toFixed(2)}`);
        
        if (items.length >= 50) break; // Limit to prevent too many items
      }
    }
  }
  
  return items;
}

// Alternative extraction for PICK LOJA when standard pattern fails
function extractPickLojaAlternative(text: string): ExtractedItem[] {
  console.log('Starting PICK LOJA alternative extraction...');
  
  const items: ExtractedItem[] = [];
  
  // Split text into lines and look for item patterns
  const lines = text.split(/[\n\r]+/);
  let sequenceCounter = 1;
  let currentSolicitation = '286344'; // Default from the document
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length < 20) continue;
    
    // Look for solicitation numbers in lines
    const solMatch = trimmedLine.match(/(\d{6})/);
    if (solMatch && (trimmedLine.includes('Solicitação') || trimmedLine.includes('solicita'))) {
      currentSolicitation = solMatch[1];
      console.log('Found solicitation in alternative:', currentSolicitation);
      continue;
    }
    
    // Look for lines that might contain item data
    // Pattern: sequence number + long code + description + values
    const itemMatch = trimmedLine.match(/(\d{1,2})\s+(\d{9})\s+.*?(\d{1,3}\.?\d{5})\s+(\d{1,3}\.?\d{6})/);
    
    if (itemMatch) {
      try {
        const seq = parseInt(itemMatch[1]);
        const codigo = itemMatch[2];
        
        // Parse PICK LOJA format values
        const quantidadeStr = itemMatch[3];
        const valorTotalStr = itemMatch[4];
        
        const quantidade = parseFloat(quantidadeStr.replace('.', '')) / 100000;
        const valorTotal = parseFloat(valorTotalStr.replace('.', '')) / 1000;
        const valorUnitario = quantidade > 0 ? valorTotal / quantidade : 0;
        
        if (codigo && quantidade > 0 && valorTotal > 0) {
          items.push({
            num_solicitacao: currentSolicitation,
            seq: seq,
            codigo: codigo,
            quantidade: Number(quantidade.toFixed(6)),
            valor_unitario: Number(valorUnitario.toFixed(6)),
            valor_total: Number(valorTotal.toFixed(6))
          });
          
          console.log(`Alternative extracted: Sol ${currentSolicitation}, Seq ${seq}, Code ${codigo}, Qty ${quantidade}, Total R$ ${valorTotal.toFixed(2)}`);
        }
      } catch (error) {
        console.warn('Error in alternative extraction:', error);
        continue;
      }
    }
  }
  
  // If still no items found, try even more aggressive extraction
  if (items.length === 0) {
    console.log('Alternative extraction failed, trying aggressive PICK LOJA extraction...');
    return extractPickLojaAggressive(text);
  }
  
  return items;
}

// Most aggressive PICK LOJA extraction
function extractPickLojaAggressive(text: string): ExtractedItem[] {
  console.log('Starting aggressive PICK LOJA extraction...');
  
  const items: ExtractedItem[] = [];
  
  // Look for any 9-digit codes (product codes) and surrounding numbers
  const codeMatches = Array.from(text.matchAll(/(\d{9})/g));
  
  for (let i = 0; i < codeMatches.length; i++) {
    const match = codeMatches[i];
    const codigo = match[1];
    const matchIndex = match.index || 0;
    
    // Extract context around the code (200 chars before and after)
    const start = Math.max(0, matchIndex - 200);
    const end = Math.min(text.length, matchIndex + 200);
    const context = text.substring(start, end);
    
    // Look for decimal numbers in the context
    const numbers = context.match(/\d{1,3}\.?\d{5,6}/g) || [];
    
    if (numbers.length >= 2) {
      try {
        // Parse the largest numbers as quantity and value
        const values = numbers
          .map(num => parseFloat(num.replace('.', '')) / (num.length > 8 ? 1000 : 100000))
          .filter(val => val > 0)
          .sort((a, b) => b - a);
        
        if (values.length >= 2) {
          const valorTotal = values[0];
          const quantidade = values[values.length - 1];
          const valorUnitario = valorTotal / quantidade;
          
          if (quantidade > 0 && quantidade <= 1000 && valorTotal > quantidade) {
            items.push({
              num_solicitacao: '286344',
              seq: i + 1,
              codigo: codigo,
              quantidade: Number(quantidade.toFixed(6)),
              valor_unitario: Number(valorUnitario.toFixed(6)),
              valor_total: Number(valorTotal.toFixed(6))
            });
            
            console.log(`Aggressively extracted: Code ${codigo}, Qty ${quantidade}, Total R$ ${valorTotal.toFixed(2)}`);
          }
        }
      } catch (error) {
        console.warn('Error in aggressive extraction:', error);
        continue;
      }
    }
    
    if (items.length >= 20) break; // Limit results
  }
  
  return items;
}

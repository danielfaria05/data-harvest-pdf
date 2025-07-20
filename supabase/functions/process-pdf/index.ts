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

    // Mock PDF extraction - In production, you would use a PDF parsing library
    // For now, we'll simulate the extraction with realistic data
    const extractedItems: ExtractedItem[] = await simulatePDFExtraction(file);
    
    console.log(`Extracted ${extractedItems.length} items from PDF`);

    if (extractedItems.length === 0) {
      console.warn('No items extracted from PDF');
      throw new Error('Nenhum item foi encontrado no PDF');
    }

    // Return extracted data WITHOUT inserting into database
    // User will decide whether to save or not
    const totalItems = extractedItems.length;
    const totalValue = extractedItems.reduce((sum, item) => sum + item.valor_total, 0);
    const uniqueSolicitations = new Set(extractedItems.map(item => item.num_solicitacao)).size;

    console.log('Extraction completed successfully');
    
    return new Response(JSON.stringify({
      extracted_items: extractedItems,
      summary: {
        quantidade_total_itens: totalItems,
        valor_total_extraido: totalValue,
        total_solicitacoes: uniqueSolicitations
      },
      mensagem: "Extração realizada com sucesso. Dados prontos para inserção."
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

// Simulate PDF extraction based on the real format shown by user
async function simulatePDFExtraction(base64File: string): Promise<ExtractedItem[]> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock extracted data respecting real PDF structure:
  // - Some solicitations have 1 item, others can have up to 20+ items
  // - Sequence resets to 1 when solicitation number changes
  const mockItems: ExtractedItem[] = [
    // Solicitação 286344 - 3 itens (seq 1, 2, 3)
    {
      num_solicitacao: "286344",
      seq: 1,
      codigo: "242401223",
      quantidade: 30.00000,
      valor_unitario: 12.081300,
      valor_total: 362.439000
    },
    {
      num_solicitacao: "286344",
      seq: 2,
      codigo: "242401312",
      quantidade: 10.00000,
      valor_unitario: 17.879400,
      valor_total: 178.794000
    },
    {
      num_solicitacao: "286344",
      seq: 3,
      codigo: "242401445",
      quantidade: 5.00000,
      valor_unitario: 89.120000,
      valor_total: 445.600000
    },
    
    // Solicitação 286348 - apenas 1 item (seq 1)
    {
      num_solicitacao: "286348",
      seq: 1,
      codigo: "201500065",
      quantidade: 2.00000,
      valor_unitario: 28.228200,
      valor_total: 56.456400
    },
    
    // Solicitação 286349 - 6 itens (seq 1 até 6)
    {
      num_solicitacao: "286349",
      seq: 1,
      codigo: "301200456",
      quantidade: 8.00000,
      valor_unitario: 75.450000,
      valor_total: 603.600000
    },
    {
      num_solicitacao: "286349",
      seq: 2,
      codigo: "301200457",
      quantidade: 3.00000,
      valor_unitario: 89.120000,
      valor_total: 267.360000
    },
    {
      num_solicitacao: "286349",
      seq: 3,
      codigo: "301200458",
      quantidade: 15.50000,
      valor_unitario: 42.300000,
      valor_total: 655.650000
    },
    {
      num_solicitacao: "286349",
      seq: 4,
      codigo: "301200459",
      quantidade: 7.25000,
      valor_unitario: 156.780000,
      valor_total: 1136.655000
    },
    {
      num_solicitacao: "286349",
      seq: 5,
      codigo: "301200460",
      quantidade: 12.00000,
      valor_unitario: 98.450000,
      valor_total: 1181.400000
    },
    {
      num_solicitacao: "286349",
      seq: 6,
      codigo: "301200461",
      quantidade: 4.75000,
      valor_unitario: 203.120000,
      valor_total: 964.820000
    },
    
    // Solicitação 286350 - 2 itens (seq 1, 2)
    {
      num_solicitacao: "286350",
      seq: 1,
      codigo: "401300789",
      quantidade: 12.00000,
      valor_unitario: 34.560000,
      valor_total: 414.720000
    },
    {
      num_solicitacao: "286350",
      seq: 2,
      codigo: "401300790",
      quantidade: 6.50000,
      valor_unitario: 156.780000,
      valor_total: 1019.070000
    },
    
    // Solicitação 286351 - 4 itens (seq 1 até 4)  
    {
      num_solicitacao: "286351",
      seq: 1,
      codigo: "501400123",
      quantidade: 25.00000,
      valor_unitario: 78.900000,
      valor_total: 1972.500000
    },
    {
      num_solicitacao: "286351",
      seq: 2,
      codigo: "501400124",
      quantidade: 18.75000,
      valor_unitario: 45.670000,
      valor_total: 856.312500
    },
    {
      num_solicitacao: "286351",
      seq: 3,
      codigo: "501400125",
      quantidade: 9.50000,
      valor_unitario: 234.560000,
      valor_total: 2228.320000
    },
    {
      num_solicitacao: "286351",
      seq: 4,
      codigo: "501400126",
      quantidade: 3.25000,
      valor_unitario: 567.890000,
      valor_total: 1845.642500
    }
  ];

  console.log(`Simulated extraction of ${mockItems.length} items from ${new Set(mockItems.map(item => item.num_solicitacao)).size} solicitations`);
  return mockItems;

  console.log(`Simulated extraction of ${mockItems.length} items`);
  return mockItems;
}

/* 
TODO: Replace simulatePDFExtraction with real PDF parsing
For production implementation, you would:

1. Install a PDF parsing library like pdf-parse or pdf2pic
2. Extract text from the PDF
3. Use regex patterns to find the specific data patterns:
   - Nº Solicitação: (\d+)
   - Seq: (\d+) 
   - Código: (\d+)
   - Qtd: ([\d,\.]+)
   - Valor: ([\d,\.]+)
4. Parse and validate the extracted numbers
5. Calculate valor_total = quantidade * valor_unitario
6. Return the structured data

Example regex patterns for Brazilian number format:
- Quantity: /Qtd:\s*([\d,\.]+)/g
- Value: /Valor:\s*([\d,\.]+)/g
- Code: /Código:\s*(\d+)/g
- Solicitation: /Nº Solicitação:\s*(\d+)/g
*/
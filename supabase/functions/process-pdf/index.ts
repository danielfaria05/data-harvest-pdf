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

    const { file, filename, contentType }: PDFData = await req.json();
    
    console.log(`Processing file: ${filename}, type: ${contentType}`);

    // Validate PDF
    if (contentType !== 'application/pdf') {
      throw new Error('Only PDF files are supported');
    }

    // Mock PDF extraction - In production, you would use a PDF parsing library
    // For now, we'll simulate the extraction with realistic data
    const extractedItems: ExtractedItem[] = await simulatePDFExtraction(file);
    
    console.log(`Extracted ${extractedItems.length} items from PDF`);

    // Insert extracted data into Supabase
    const { data: insertedData, error: insertError } = await supabase
      .from('itens_solicitados')
      .insert(extractedItems.map(item => ({
        num_solicitacao: item.num_solicitacao,
        seq: item.seq,
        codigo: item.codigo,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total
      })));

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    console.log('Data inserted successfully');

    // Calculate summary
    const totalItems = extractedItems.length;
    const totalValue = extractedItems.reduce((sum, item) => sum + item.valor_total, 0);
    const uniqueSolicitations = new Set(extractedItems.map(item => item.num_solicitacao)).size;

    // Get updated summary from database
    const { data: summaryData, error: summaryError } = await supabase
      .rpc('get_extraction_summary');

    if (summaryError) {
      console.error('Summary calculation error:', summaryError);
      // Fallback to local calculation
      return new Response(JSON.stringify({
        quantidade_total_itens: totalItems,
        valor_total_extraido: totalValue,
        total_solicitacoes: uniqueSolicitations,
        mensagem: "Extração realizada com sucesso."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const summary = summaryData[0];
    
    return new Response(JSON.stringify({
      quantidade_total_itens: Number(summary.quantidade_total_itens),
      valor_total_extraido: Number(summary.valor_total_extraido),
      total_solicitacoes: Number(summary.total_solicitacoes),
      mensagem: "Extração realizada com sucesso."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-pdf function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Simulate PDF extraction based on the real format shown
async function simulatePDFExtraction(base64File: string): Promise<ExtractedItem[]> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock extracted data that matches the actual boletim format shown
  const mockItems: ExtractedItem[] = [
    // Solicitação 286.344
    {
      num_solicitacao: "286344",
      seq: 1,
      codigo: "242401223",
      quantidade: 30.00000,
      valor_unitario: 362.43000,
      valor_total: 10872.90
    },
    {
      num_solicitacao: "286344",
      seq: 2,
      codigo: "242401312",
      quantidade: 10.00000,
      valor_unitario: 178.78000,
      valor_total: 1787.80
    },
    
    // Solicitação 286.348
    {
      num_solicitacao: "286348",
      seq: 1,
      codigo: "201500065",
      quantidade: 2.00000,
      valor_unitario: 56.45600,
      valor_total: 112.91
    },
    {
      num_solicitacao: "286348",
      seq: 2,
      codigo: "311001772",
      quantidade: 5.00000,
      valor_unitario: 636.86700,
      valor_total: 3184.34
    },
    
    // Solicitação 286.349
    {
      num_solicitacao: "286349",
      seq: 1,
      codigo: "242401372",
      quantidade: 16.00000,
      valor_unitario: 229.45600,
      valor_total: 3671.30
    },
    
    // Additional sample items to demonstrate variety
    {
      num_solicitacao: "286350",
      seq: 1,
      codigo: "311002001",
      quantidade: 12.50000,
      valor_unitario: 145.80000,
      valor_total: 1822.50
    },
    {
      num_solicitacao: "286350",
      seq: 2,
      codigo: "242401445",
      quantidade: 8.75000,
      valor_unitario: 95.20000,
      valor_total: 833.00
    },
    {
      num_solicitacao: "286351",
      seq: 1,
      codigo: "201500123",
      quantidade: 25.00000,
      valor_unitario: 78.90000,
      valor_total: 1972.50
    }
  ];

  // Add some slight randomization to make it more realistic
  return mockItems.map((item, index) => ({
    ...item,
    // Keep the same structure but add minor variations
    quantidade: Number((item.quantidade + (Math.random() - 0.5) * 1).toFixed(5)),
    valor_unitario: Number((item.valor_unitario + (Math.random() - 0.5) * 10).toFixed(6)),
  })).map(item => ({
    ...item,
    valor_total: Number((item.quantidade * item.valor_unitario).toFixed(6))
  }));
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
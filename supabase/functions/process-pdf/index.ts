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

// Simulate PDF extraction - replace with actual PDF parsing logic
async function simulatePDFExtraction(base64File: string): Promise<ExtractedItem[]> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock extracted data that simulates a real boletim de medição
  const mockItems: ExtractedItem[] = [
    {
      num_solicitacao: "286344",
      seq: 1,
      codigo: "242401223",
      quantidade: 30.00000,
      valor_unitario: 362.439000,
      valor_total: 10873.17
    },
    {
      num_solicitacao: "286344",
      seq: 2,
      codigo: "242401224",
      quantidade: 15.50000,
      valor_unitario: 125.80000,
      valor_total: 1949.40
    },
    {
      num_solicitacao: "286345",
      seq: 1,
      codigo: "242401225",
      quantidade: 8.00000,
      valor_unitario: 450.75000,
      valor_total: 3606.00
    },
    {
      num_solicitacao: "286345",
      seq: 2,
      codigo: "242401226",
      quantidade: 22.30000,
      valor_unitario: 89.50000,
      valor_total: 1995.85
    },
    {
      num_solicitacao: "286346",
      seq: 1,
      codigo: "242401227",
      quantidade: 12.75000,
      valor_unitario: 678.90000,
      valor_total: 8655.98
    },
    {
      num_solicitacao: "286346",
      seq: 2,
      codigo: "242401228",
      quantidade: 5.25000,
      valor_unitario: 234.60000,
      valor_total: 1231.65
    },
    {
      num_solicitacao: "286347",
      seq: 1,
      codigo: "242401229",
      quantidade: 18.00000,
      valor_unitario: 156.25000,
      valor_total: 2812.50
    },
    {
      num_solicitacao: "286347",
      seq: 2,
      codigo: "242401230",
      quantidade: 45.60000,
      valor_unitario: 98.75000,
      valor_total: 4503.00
    }
  ];

  // Add some randomization to make it more realistic
  const randomizedItems = mockItems.map((item, index) => ({
    ...item,
    seq: index + 1,
    quantidade: item.quantidade + (Math.random() - 0.5) * 2,
    valor_unitario: item.valor_unitario + (Math.random() - 0.5) * 50,
  }));

  // Recalculate valor_total
  return randomizedItems.map(item => ({
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
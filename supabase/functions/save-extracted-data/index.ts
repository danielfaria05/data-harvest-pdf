import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    console.log('Save extracted data started');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const requestBody = await req.json();
    console.log('Request received with keys:', Object.keys(requestBody));
    
    const { extracted_items, semana }: { 
      extracted_items: ExtractedItem[];
      semana: string;
    } = requestBody;
    
    if (!extracted_items || !Array.isArray(extracted_items) || extracted_items.length === 0) {
      throw new Error('Nenhum item foi fornecido para inserção');
    }

    if (!semana || !semana.trim()) {
      throw new Error('A semana é obrigatória');
    }

    const cleanSemana = semana.trim();

    console.log(`Processing data for week: ${cleanSemana}`);

    // Check if data for this week already exists and delete it
    console.log('Checking for existing data for this week...');
    const { data: existingData, error: checkError } = await supabase
      .from('itens_solicitados')
      .select('id')
      .eq('semana', cleanSemana);

    if (checkError) {
      console.error('Error checking existing data:', checkError);
      throw new Error(`Erro ao verificar dados existentes: ${checkError.message}`);
    }

    if (existingData && existingData.length > 0) {
      console.log(`Found ${existingData.length} existing records for week ${cleanSemana}. Deleting...`);
      
      const { error: deleteError } = await supabase
        .from('itens_solicitados')
        .delete()
        .eq('semana', cleanSemana);

      if (deleteError) {
        console.error('Error deleting existing data:', deleteError);
        throw new Error(`Erro ao deletar dados existentes: ${deleteError.message}`);
      }

      console.log('Existing data deleted successfully');
    } else {
      console.log('No existing data found for this week');
    }

    console.log(`Inserting ${extracted_items.length} items into database...`);

    // Insert extracted data into Supabase with week information
    const { data: insertedData, error: insertError } = await supabase
      .from('itens_solicitados')
      .insert(extracted_items.map(item => ({
        num_solicitacao: item.num_solicitacao,
        seq: item.seq,
        codigo: item.codigo,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
        semana: cleanSemana
      })));

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error(`Erro ao salvar dados: ${insertError.message}`);
    }

    console.log('Data inserted successfully');

    // Get updated summary from database
    console.log('Calculating summary from database...');
    const { data: summaryData, error: summaryError } = await supabase
      .rpc('get_extraction_summary');

    if (summaryError) {
      console.error('Summary calculation error:', summaryError);
      // Fallback to local calculation
      const totalItems = extracted_items.length;
      const totalValue = extracted_items.reduce((sum, item) => sum + item.valor_total, 0);
      const uniqueSolicitations = new Set(extracted_items.map(item => item.num_solicitacao)).size;
      
      return new Response(JSON.stringify({
        quantidade_total_itens: totalItems,
        valor_total_extraido: totalValue,
        total_solicitacoes: uniqueSolicitations,
        mensagem: "Dados inseridos com sucesso no banco de dados."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const summary = summaryData[0];
    console.log('Summary calculated:', summary);
    
    return new Response(JSON.stringify({
      quantidade_total_itens: Number(summary.quantidade_total_itens),
      valor_total_extraido: Number(summary.valor_total_extraido),
      total_solicitacoes: Number(summary.total_solicitacoes),
      mensagem: "Dados inseridos com sucesso no banco de dados."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in save-extracted-data function:', error);
    
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
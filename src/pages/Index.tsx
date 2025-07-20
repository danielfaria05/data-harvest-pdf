import React, { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ProcessingResults } from '@/components/ProcessingResults';
import { ExtractedDataPreview } from '@/components/ExtractedDataPreview';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { FileText, Database, TrendingUp } from 'lucide-react';

interface ExtractedItem {
  num_solicitacao: string;
  seq: number;
  codigo: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface ExtractionResult {
  quantidade_total_itens: number;
  valor_total_extraido: number;
  total_solicitacoes: number;
  semana?: string;
  mensagem: string;
}

interface ExtractedDataResponse {
  extracted_items: ExtractedItem[];
  summary: {
    quantidade_total_itens: number;
    valor_total_extraido: number;
    total_solicitacoes: number;
  };
  mensagem: string;
}

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedDataResponse | null>(null);
  const [savedResult, setSavedResult] = useState<ExtractionResult | null>(null);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setExtractedData(null);
    setSavedResult(null);
    
    try {
      console.log('Iniciando processamento do arquivo:', file.name, 'Tamanho:', file.size);
      
      // Convert file to base64 safely for larger files
      const fileBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(fileBuffer);
      
      // Convert to base64 in chunks to avoid call stack overflow
      let binary = '';
      const chunkSize = 8192; // Process in 8KB chunks
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64File = btoa(binary);
      
      console.log('Arquivo convertido para base64, enviando para Edge Function...');
      
      const { data, error } = await supabase.functions.invoke('process-pdf', {
        body: {
          file: base64File,
          filename: file.name,
          contentType: file.type
        }
      });

      console.log('Resposta da Edge Function:', { data, error });

      if (error) {
        console.error('Erro da Edge Function:', error);
        throw new Error(`Erro no processamento: ${error.message || 'Erro desconhecido'}`);
      }

      if (!data) {
        throw new Error('Nenhum dado retornado pela função de processamento');
      }

      setExtractedData(data);
      toast({
        title: "Extração concluída!",
        description: `${data.summary.quantidade_total_itens} itens extraídos. Aguardando confirmação para salvar.`,
      });

    } catch (error) {
      console.error('Erro completo ao processar PDF:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Erro desconhecido ao processar o PDF';
      
      toast({
        title: "Erro no processamento",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveData = async (semana: string) => {
    if (!extractedData) return;
    
    setIsSaving(true);
    
    try {
      console.log('Salvando dados extraídos no banco para a semana:', semana);
      
      const { data, error } = await supabase.functions.invoke('save-extracted-data', {
        body: {
          extracted_items: extractedData.extracted_items,
          semana: semana
        }
      });

      if (error) {
        console.error('Erro ao salvar dados:', error);
        throw new Error(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
      }

      if (!data) {
        throw new Error('Nenhuma resposta da função de salvamento');
      }

      setSavedResult(data);
      setExtractedData(null); // Clear extracted data after saving
      
      toast({
        title: "Dados salvos!",
        description: `${data.quantidade_total_itens} itens foram inseridos no banco de dados.`,
      });

    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Erro desconhecido ao salvar os dados';
      
      toast({
        title: "Erro ao salvar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearData = () => {
    setExtractedData(null);
    setSavedResult(null);
    
    toast({
      title: "Dados limpos",
      description: "Os dados extraídos foram descartados.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Extrator de BM Semanal
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Faça upload do seu PDF de Boletim de Medição e extraia os dados automaticamente.
          </p>
        </div>

        {/* Upload Section */}
        <div className="max-w-2xl mx-auto mb-8">
          <FileUpload 
            onFileUpload={handleFileUpload} 
            isProcessing={isProcessing}
          />
        </div>

        {/* Extracted Data Preview Section */}
        {extractedData && (
          <div className="max-w-6xl mx-auto mb-8">
            <ExtractedDataPreview
              extractedItems={extractedData.extracted_items}
              summary={extractedData.summary}
              onSaveData={handleSaveData}
              onClearData={handleClearData}
              isLoading={isSaving}
            />
          </div>
        )}

        {/* Final Results Section */}
        {savedResult && (
          <div className="max-w-6xl mx-auto">
            <ProcessingResults result={savedResult} />
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;

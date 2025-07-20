import React, { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ProcessingResults } from '@/components/ProcessingResults';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { FileText, Database, TrendingUp } from 'lucide-react';

interface ExtractionResult {
  quantidade_total_itens: number;
  valor_total_extraido: number;
  total_solicitacoes: number;
  mensagem: string;
}

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setExtractionResult(null);
    
    try {
      console.log('Iniciando processamento do arquivo:', file.name, 'Tamanho:', file.size);
      
      // Convert file to base64 for transmission
      const fileBuffer = await file.arrayBuffer();
      const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
      
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

      setExtractionResult(data);
      toast({
        title: "Extração concluída!",
        description: `${data.quantidade_total_itens} itens processados com sucesso.`,
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary-glow blur-xl opacity-30 rounded-full"></div>
              <div className="relative bg-card p-6 rounded-2xl border border-border">
                <FileText className="h-16 w-16 text-primary mx-auto" />
              </div>
            </div>
          </div>
          
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            PDF Data Harvest
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Sistema inteligente para extração automática de dados de boletins de medição. 
            Faça upload do seu PDF e veja os dados estruturados instantaneamente.
          </p>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
            <div className="bg-card p-6 rounded-xl border border-border hover:border-primary/50 transition-all duration-300">
              <Database className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-card-foreground">Extração Automática</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Dados extraídos e estruturados automaticamente
              </p>
            </div>
            
            <div className="bg-card p-6 rounded-xl border border-border hover:border-primary/50 transition-all duration-300">
              <TrendingUp className="h-8 w-8 text-success mx-auto mb-3" />
              <h3 className="font-semibold text-card-foreground">Validação Inteligente</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Cálculos automáticos e validação de dados
              </p>
            </div>
            
            <div className="bg-card p-6 rounded-xl border border-border hover:border-primary/50 transition-all duration-300">
              <FileText className="h-8 w-8 text-warning mx-auto mb-3" />
              <h3 className="font-semibold text-card-foreground">Resultados Instantâneos</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Visualize totais e dados extraídos em tempo real
              </p>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="max-w-2xl mx-auto mb-8">
          <FileUpload 
            onFileUpload={handleFileUpload} 
            isProcessing={isProcessing}
          />
        </div>

        {/* Results Section */}
        {extractionResult && (
          <div className="max-w-6xl mx-auto">
            <ProcessingResults result={extractionResult} />
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;

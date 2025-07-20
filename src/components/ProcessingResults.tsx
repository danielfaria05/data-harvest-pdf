import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, FileText, Calculator, TrendingUp, Download, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ExtractionResult {
  quantidade_total_itens: number;
  valor_total_extraido: number;
  total_solicitacoes: number;
  mensagem: string;
}

interface ItemData {
  id: string;
  num_solicitacao: string;
  seq: number;
  codigo: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  data_extracao: string;
}

interface ProcessingResultsProps {
  result: ExtractionResult;
}

export const ProcessingResults: React.FC<ProcessingResultsProps> = ({ result }) => {
  const [itemsData, setItemsData] = useState<ItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadLatestItems();
  }, [result]);

  const loadLatestItems = async () => {
    try {
      const { data, error } = await supabase
        .from('itens_solicitados')
        .select('*')
        .order('data_extracao', { ascending: false })
        .limit(50);

      if (error) throw error;
      setItemsData(data || []);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center py-8">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="absolute inset-0 bg-success/30 blur-xl rounded-full animate-pulse"></div>
            <CheckCircle className="relative h-16 w-16 text-success" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Extração Concluída!</h2>
        <p className="text-muted-foreground">{result.mensagem}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-success/20 bg-gradient-to-br from-success/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-success" />
              Total de Itens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {result.quantidade_total_itens.toLocaleString('pt-BR')}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Itens extraídos e processados
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-primary" />
              Valor Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(result.valor_total_extraido)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Soma de todos os valores
            </p>
          </CardContent>
        </Card>

        <Card className="border-warning/20 bg-gradient-to-br from-warning/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-warning" />
              Solicitações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">
              {result.total_solicitacoes.toLocaleString('pt-BR')}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Números de solicitação únicos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button 
          onClick={() => setShowDetails(!showDetails)}
          variant="outline"
          size="lg"
          className="flex-1 sm:flex-none"
        >
          <Eye className="h-4 w-4 mr-2" />
          {showDetails ? 'Ocultar Detalhes' : 'Ver Detalhes'}
        </Button>
        
        <Button 
          onClick={() => {
            // Implementar download CSV/Excel
            console.log('Download dados...');
          }}
          size="lg"
          className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-primary-glow hover:from-primary/90 hover:to-primary-glow/90"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar Dados
        </Button>
      </div>

      {/* Detailed Items Table */}
      {showDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Itens Extraídos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-muted-foreground">Carregando detalhes...</p>
              </div>
            ) : (
              <ScrollArea className="h-96 w-full">
                <div className="space-y-4">
                  {itemsData.map((item, index) => (
                    <div key={item.id} className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Sol. {item.num_solicitacao}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              Seq: {item.seq}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Código:</span> {item.codigo}
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Qtd:</span>
                            <span className="font-medium ml-1">{formatNumber(item.quantidade)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Valor Unit:</span>
                            <span className="font-medium ml-1">{formatCurrency(item.valor_unitario)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-bold text-primary ml-1">{formatCurrency(item.valor_total)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      <Separator className="my-8" />
      
      {/* Footer Message */}
      <div className="text-center text-sm text-muted-foreground">
        <p>Dados extraídos e armazenados com sucesso no banco de dados.</p>
        <p>Use os botões acima para exportar ou visualizar mais detalhes.</p>
      </div>
    </div>
  );
};
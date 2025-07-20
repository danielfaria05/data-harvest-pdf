import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Save, Trash2, FileText, DollarSign, Package } from 'lucide-react';

interface ExtractedItem {
  num_solicitacao: string;
  seq: number;
  codigo: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface ExtractedDataPreviewProps {
  extractedItems: ExtractedItem[];
  summary: {
    quantidade_total_itens: number;
    valor_total_extraido: number;
    total_solicitacoes: number;
  };
  onSaveData: () => void;
  onClearData: () => void;
  isLoading?: boolean;
}

export const ExtractedDataPreview: React.FC<ExtractedDataPreviewProps> = ({
  extractedItems,
  summary,
  onSaveData,
  onClearData,
  isLoading = false
}) => {
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <Package className="h-8 w-8 text-primary mr-4" />
            <div>
              <p className="text-2xl font-bold">{summary.quantidade_total_itens}</p>
              <p className="text-sm text-muted-foreground">Itens Extraídos</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <DollarSign className="h-8 w-8 text-success mr-4" />
            <div>
              <p className="text-2xl font-bold">{formatCurrency(summary.valor_total_extraido)}</p>
              <p className="text-sm text-muted-foreground">Valor Total</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <FileText className="h-8 w-8 text-warning mr-4" />
            <div>
              <p className="text-2xl font-bold">{summary.total_solicitacoes}</p>
              <p className="text-sm text-muted-foreground">Solicitações</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Dados Extraídos - Aguardando Confirmação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Button 
              onClick={onSaveData}
              disabled={isLoading}
              className="flex-1"
              size="lg"
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Salvando...' : 'Adicionar Informações ao Banco'}
            </Button>
            
            <Button 
              onClick={onClearData}
              variant="outline"
              disabled={isLoading}
              className="flex-1"
              size="lg"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          </div>

          <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
            <p className="font-medium mb-2">⚠️ Importante:</p>
            <p>
              Os dados foram extraídos com sucesso do PDF, mas ainda não foram salvos no banco de dados. 
              Clique em "Adicionar Informações ao Banco" para confirmar a inserção ou "Limpar" para descartar os dados.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes dos Itens Extraídos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Solicitação</TableHead>
                  <TableHead>Seq</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Valor Unitário</TableHead>
                  <TableHead>Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extractedItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Badge variant="outline">{item.num_solicitacao}</Badge>
                    </TableCell>
                    <TableCell>{item.seq}</TableCell>
                    <TableCell className="font-mono">{item.codigo}</TableCell>
                    <TableCell>{formatNumber(item.quantidade)}</TableCell>
                    <TableCell>{formatCurrency(item.valor_unitario)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(item.valor_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
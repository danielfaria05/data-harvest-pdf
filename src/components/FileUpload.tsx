import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  isProcessing: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, isProcessing }) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      setUploadProgress(0);
      console.log('Arquivo aceito para upload:', file.name, file.size, 'bytes');
      onFileUpload(file);
      
      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);
    } else {
      console.error('Arquivo rejeitado:', file?.type || 'tipo desconhecido');
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  const hasRejectedFiles = fileRejections.length > 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300",
          "hover:border-primary/50 hover:bg-primary/5",
          isDragActive || dragActive ? "border-primary bg-primary/10 scale-[1.02]" : "border-border",
          hasRejectedFiles ? "border-destructive bg-destructive/5" : "",
          isProcessing ? "pointer-events-none opacity-75" : ""
        )}
      >
        <input {...getInputProps()} />
        
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl"></div>
        
        <div className="relative z-10">
          {isProcessing ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse"></div>
                  <Loader2 className="relative h-16 w-16 text-primary animate-spin" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Processando PDF...</h3>
                <p className="text-muted-foreground">Extraindo dados do boletim de medição</p>
                <div className="w-full max-w-md mx-auto">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{uploadProgress}% concluído</p>
                </div>
              </div>
            </div>
          ) : hasRejectedFiles ? (
            <div className="space-y-4">
              <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-destructive">Arquivo inválido</h3>
                <p className="text-muted-foreground">Apenas arquivos PDF são aceitos</p>
              </div>
            </div>
          ) : isDragActive || dragActive ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full animate-pulse"></div>
                  <CheckCircle className="relative h-16 w-16 text-primary animate-bounce" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-primary">Solte o arquivo aqui</h3>
                <p className="text-muted-foreground">PDF será processado automaticamente</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary-glow/20 blur-xl rounded-full"></div>
                  <div className="relative bg-card p-6 rounded-2xl border border-border">
                    <Upload className="h-12 w-12 text-primary mx-auto" />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Faça upload do seu PDF
                </h3>
                <p className="text-muted-foreground mb-4">
                  Arraste e solte o boletim de medição aqui ou clique para selecionar
                </p>
                
                <Button className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary/90 hover:to-primary-glow/90">
                  <FileText className="h-4 w-4 mr-2" />
                  Selecionar PDF
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Formato aceito: PDF</p>
                <p>• Tamanho máximo: 10MB</p>
                <p>• Padrão: Boletim de medição</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
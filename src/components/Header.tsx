import React from 'react';
import { FileText, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Header = () => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-md rounded-lg"></div>
              <div className="relative bg-primary p-2 rounded-lg">
                <FileText className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">PDF Data Harvest</h1>
              <p className="text-sm text-muted-foreground">Extração inteligente de dados</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" className="hidden md:flex">
              <Github className="h-4 w-4 mr-2" />
              Documentação
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
-- Create the items table for storing extracted PDF data
CREATE TABLE public.itens_solicitados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  num_solicitacao TEXT NOT NULL,
  seq INTEGER NOT NULL,
  codigo TEXT NOT NULL,
  quantidade DECIMAL(12,5) NOT NULL,
  valor_unitario DECIMAL(15,6) NOT NULL,
  valor_total DECIMAL(15,6) NOT NULL,
  data_extracao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.itens_solicitados ENABLE ROW LEVEL SECURITY;

-- Create policies for access control
CREATE POLICY "Anyone can view items" 
ON public.itens_solicitados 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert items" 
ON public.itens_solicitados 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_itens_num_solicitacao ON public.itens_solicitados(num_solicitacao);
CREATE INDEX idx_itens_data_extracao ON public.itens_solicitados(data_extracao);
CREATE INDEX idx_itens_codigo ON public.itens_solicitados(codigo);

-- Create a function to calculate extraction summary
CREATE OR REPLACE FUNCTION public.get_extraction_summary()
RETURNS TABLE (
  quantidade_total_itens BIGINT,
  valor_total_extraido DECIMAL(15,6),
  total_solicitacoes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as quantidade_total_itens,
    SUM(valor_total)::DECIMAL(15,6) as valor_total_extraido,
    COUNT(DISTINCT num_solicitacao)::BIGINT as total_solicitacoes
  FROM public.itens_solicitados;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
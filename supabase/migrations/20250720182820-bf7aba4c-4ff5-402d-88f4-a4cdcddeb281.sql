-- Add semana column to itens_solicitados table
ALTER TABLE public.itens_solicitados 
ADD COLUMN semana TEXT;

-- Create index for better performance when querying by week
CREATE INDEX idx_itens_solicitados_semana ON public.itens_solicitados(semana);
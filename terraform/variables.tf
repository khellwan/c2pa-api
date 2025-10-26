variable "project_name" {
  description = "Nome do projeto"
  type        = string
  default     = "c2pa-api"
}

variable "environment" {
  description = "Ambiente (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "Região AWS"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domínio customizado (opcional)"
  type        = string
  default     = ""
}

variable "lambda_image_uri" {
  description = "URI da imagem Docker no ECR para Lambda API"
  type        = string
  default     = ""
}

variable "lambda_worker_image_uri" {
  description = "URI da imagem Docker no ECR para Lambda Worker"
  type        = string
  default     = ""
}

variable "lambda_memory" {
  description = "Memória do Lambda em MB"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Timeout do Lambda em segundos"
  type        = number
  default     = 30
}

variable "s3_retention_days" {
  description = "Dias para mover arquivos para IA após criação"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags padrão para todos os recursos"
  type        = map(string)
  default = {
    Project   = "c2pa-api"
    ManagedBy = "terraform"
  }
}
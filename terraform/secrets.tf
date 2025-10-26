# Secrets Manager para chaves C2PA
resource "aws_secretsmanager_secret" "c2pa_keys" {
  name                    = "${local.name_prefix}-c2pa-keys"
  description             = "Chaves privadas e certificados para C2PA"
  kms_key_id              = aws_kms_key.main.key_id
  recovery_window_in_days = 7

  tags = {
    Name = "${local.name_prefix}-c2pa-keys"
  }
}

# Versão do secret (placeholder - será atualizada manualmente)
resource "aws_secretsmanager_secret_version" "c2pa_keys" {
  secret_id = aws_secretsmanager_secret.c2pa_keys.id
  secret_string = jsonencode({
    private_key   = "PLACEHOLDER_PRIVATE_KEY"
    certificate   = "PLACEHOLDER_CERTIFICATE"
    ca_chain      = "PLACEHOLDER_CA_CHAIN"
    passphrase    = "PLACEHOLDER_PASSPHRASE"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
# SQS Queue - Manifest processing jobs
resource "aws_sqs_queue" "manifest_jobs" {
  name                      = "${local.name_prefix}-manifest-jobs"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 1209600 # 14 days
  receive_wait_time_seconds = 0
  visibility_timeout_seconds = 300

  # Dead Letter Queue
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.manifest_jobs_dlq.arn
    maxReceiveCount     = 3
  })

  # Encryption at rest
  kms_master_key_id                 = aws_kms_key.main.key_id
  kms_data_key_reuse_period_seconds = 300

  tags = {
    Name = "${local.name_prefix}-manifest-jobs"
  }
}

# Dead Letter Queue
resource "aws_sqs_queue" "manifest_jobs_dlq" {
  name                      = "${local.name_prefix}-manifest-jobs-dlq"
  message_retention_seconds = 1209600 # 14 days

  # Encryption at rest
  kms_master_key_id                 = aws_kms_key.main.key_id
  kms_data_key_reuse_period_seconds = 300

  tags = {
    Name = "${local.name_prefix}-manifest-jobs-dlq"
  }
}

# CloudWatch alarms for DLQ
resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  alarm_name          = "${local.name_prefix}-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ApproximateNumberOfVisibleMessages"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors dlq messages"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    QueueName = aws_sqs_queue.manifest_jobs_dlq.name
  }

  tags = {
    Name = "${local.name_prefix}-dlq-alarm"
  }
}

# SNS Topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"

  kms_master_key_id = aws_kms_key.main.key_id

  tags = {
    Name = "${local.name_prefix}-alerts"
  }
}
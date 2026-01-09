variable "name" {
  description = "Name prefix for network resources"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR for lab VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "gateway_cidr" {
  description = "CIDR of on-prem/VPN gateway allowed into labs"
  type        = string
}

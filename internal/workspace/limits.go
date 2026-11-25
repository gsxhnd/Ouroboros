package workspace

import "github.com/gsxhnd/ourboros/internal/units"

// ValidateBWLimit 校验限速值：空或 "off" 表示不限速，其余必须是单个大小值。
func ValidateBWLimit(value string) error { return units.ValidateLimit(value) }

// ValidateMaxTransfer 校验单次同步大小上限：空或 "off" 表示无上限。
func ValidateMaxTransfer(value string) error { return units.ValidateLimit(value) }

package rclone

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/gsxhnd/ourboros/internal/core"
)

func extractRcloneBinary(zipBytes []byte, dest string) error {
	reader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		return core.InvalidRequest("invalid rclone zip: " + err.Error())
	}
	for _, file := range reader.File {
		name := strings.ReplaceAll(file.Name, `\`, "/")
		if strings.Contains(name, "__MACOSX") {
			continue
		}
		base := name
		if slash := strings.LastIndex(name, "/"); slash >= 0 {
			base = name[slash+1:]
		}
		if base != "rclone" && base != "rclone.exe" {
			continue
		}
		if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
			return core.IO(err)
		}
		src, err := file.Open()
		if err != nil {
			return core.InvalidRequest("invalid rclone zip: " + err.Error())
		}
		out, err := os.OpenFile(dest, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
		if err != nil {
			src.Close()
			return core.IO(err)
		}
		_, copyErr := io.Copy(out, src)
		src.Close()
		closeErr := out.Close()
		if copyErr != nil {
			return core.IO(copyErr)
		}
		if closeErr != nil {
			return core.IO(closeErr)
		}
		if runtime.GOOS != "windows" {
			if err := os.Chmod(dest, 0o755); err != nil {
				return core.IO(err)
			}
		}
		return nil
	}
	return core.NotFound("rclone binary inside downloaded archive")
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

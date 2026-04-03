package logger

import (
	"io"
	"os"
	"path/filepath"

	"github.com/sirupsen/logrus"
	"gopkg.in/natefinch/lumberjack.v2"
)

var Log = logrus.New()

func Init(exeDir string) {
	logPath := filepath.Join(exeDir, "logs", "app.log")
	if err := os.MkdirAll(filepath.Dir(logPath), 0755); err != nil {
		Log.SetOutput(os.Stderr)
		return
	}

	roller := &lumberjack.Logger{
		Filename:   logPath,
		MaxSize:    1, // MB
		MaxBackups: 3,
		Compress:   false,
	}

	Log.SetOutput(io.MultiWriter(roller, os.Stderr))
	Log.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
	})
	Log.SetLevel(logrus.DebugLevel)
}

// LogDir returns the directory where log files are stored.
func LogDir(exeDir string) string {
	return filepath.Join(exeDir, "logs")
}

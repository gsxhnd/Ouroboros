package app

type Config struct {
	DataDir   string
	BindHost  string
	BindPort  int
	AuthToken string
	// HistoryPath 指向同步执行历史的 bbolt 数据库文件；空表示不记录历史。
	HistoryPath  string
	RcloneBin    string
	RcloneURL    string
	RcloneConfig string
	RcloneUser   string
	RclonePass   string
}

func (c Config) withDefaults() Config {
	if c.BindHost == "" {
		c.BindHost = "127.0.0.1"
	}
	if c.BindPort == 0 {
		c.BindPort = 8080
	}
	return c
}

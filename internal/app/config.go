package app

type Config struct {
	DataDir      string
	BindHost     string
	BindPort     int
	AuthToken    string
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

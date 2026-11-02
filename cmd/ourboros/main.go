package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/gsxhnd/ourboros/internal/cli"
	"github.com/gsxhnd/ourboros/internal/serve"
	"github.com/gsxhnd/ourboros/internal/version"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, nil)))
	command, err := cli.Parse(os.Args[1:])
	if err != nil {
		if cli.IsHelp(err) {
			fmt.Print(cli.Help())
			return
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	switch command.Name {
	case "help", "":
		fmt.Print(cli.Help())
	case "version":
		fmt.Println("ourboros v" + version.Version)
	case "server":
		if err := run(command.Server); err != nil {
			slog.Error("server exited", "err", err)
			os.Exit(1)
		}
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n", command.Name)
		os.Exit(2)
	}
}

func run(args cli.ServerArgs) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	running, err := serve.Run(ctx, args)
	if err != nil {
		return err
	}
	slog.Info("ourboros server listening", "url", running.URL)
	<-ctx.Done()
	<-running.Done
	return nil
}

package main

import (
	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/settings"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// watchSettings re-registers shortcuts whenever the settings change.
func (t *trayShell) watchSettings(bus *events.Bus) {
	ch, cancel := bus.Subscribe()
	defer cancel()
	t.registerShortcuts(t.svc.Settings.Get())
	for {
		select {
		case <-t.ctx.Done():
			return
		case ev, ok := <-ch:
			if !ok {
				return
			}
			if ev.Name != events.NameSettings {
				continue
			}
			if doc, ok := ev.Payload.(settings.Document); ok {
				t.registerShortcuts(doc)
			}
		}
	}
}

// registerShortcuts replaces the previously registered accelerators with the
// ones from doc. Each action runs on the Go side, the same as the panel buttons.
func (t *trayShell) registerShortcuts(doc settings.Document) {
	t.mu.Lock()
	for _, accel := range t.bindings {
		t.app.KeyBinding.Remove(accel)
	}
	t.bindings = nil
	t.mu.Unlock()

	actions := map[string]func(){
		"show_main":     t.showWindow,
		"toggle_panel":  t.togglePanel,
		"toggle_rclone": t.rcloneToggleAction,
		"quit":          func() { t.app.Quit() },
	}
	resolved := doc.ResolvedShortcuts()
	for _, action := range settings.ShortcutActions {
		accel := resolved[action]
		run := actions[action]
		if accel == "" || run == nil {
			continue
		}
		t.app.KeyBinding.Add(accel, func(application.Window) { run() })
		t.mu.Lock()
		t.bindings = append(t.bindings, accel)
		t.mu.Unlock()
	}
}

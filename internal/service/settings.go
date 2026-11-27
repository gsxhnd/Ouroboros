package service

import (
	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/settings"
)

type Settings struct{ serviceBase }

func (s *Settings) Get() settings.Document {
	return s.state.Settings.Get()
}

func (s *Settings) Patch(patch settings.Patch) (settings.Document, error) {
	if err := s.state.CheckSettingsPatch(patch); err != nil {
		return settings.Document{}, err
	}
	doc, err := s.state.Settings.Patch(patch)
	if err != nil {
		return settings.Document{}, err
	}
	if len(patch.Shortcuts) > 0 {
		s.state.Events.Publish(events.NameSettings, doc)
	}
	s.state.ApplySettings(doc)
	return doc, nil
}

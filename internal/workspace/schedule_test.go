package workspace

import "testing"

func TestScheduleCronExpression(t *testing.T) {
	cron := "*/5 * * * *"
	empty := ""
	cases := []struct {
		name     string
		schedule Schedule
		want     string
		wantErr  bool
	}{
		{"hourly", Schedule{Mode: ModePreset, Preset: ptrPreset(PresetHourly)}, "0 * * * *", false},
		{"daily", Schedule{Mode: ModePreset, Preset: ptrPreset(PresetDaily)}, "0 0 * * *", false},
		{"weekly", Schedule{Mode: ModePreset, Preset: ptrPreset(PresetWeekly)}, "0 0 * * 0", false},
		{"cron passthrough", Schedule{Mode: ModeCron, Cron: &cron}, cron, false},
		{"preset missing", Schedule{Mode: ModePreset}, "", true},
		{"cron missing", Schedule{Mode: ModeCron}, "", true},
		{"cron empty", Schedule{Mode: ModeCron, Cron: &empty}, "", true},
		{"unknown mode", Schedule{Mode: "weird"}, "", true},
	}
	for _, tc := range cases {
		got, err := tc.schedule.CronExpression()
		if (err != nil) != tc.wantErr || got != tc.want {
			t.Errorf("%s: got (%q, %v), want (%q, err=%v)", tc.name, got, err, tc.want, tc.wantErr)
		}
	}
}

func TestValidateScheduleSharesExpressionRules(t *testing.T) {
	bad := "not a cron"
	good := "0 3 * * 1"
	for name, tc := range map[string]struct {
		schedule Schedule
		wantErr  bool
	}{
		"valid preset":      {Schedule{Mode: ModePreset, Preset: ptrPreset(PresetDaily), Timezone: "UTC"}, false},
		"valid cron":        {Schedule{Mode: ModeCron, Cron: &good, Timezone: "UTC"}, false},
		"bad cron syntax":   {Schedule{Mode: ModeCron, Cron: &bad, Timezone: "UTC"}, true},
		"bad timezone":      {Schedule{Mode: ModePreset, Preset: ptrPreset(PresetDaily), Timezone: "Mars/Base"}, true},
		"preset without id": {Schedule{Mode: ModePreset, Timezone: "UTC"}, true},
	} {
		if err := ValidateSchedule(tc.schedule); (err != nil) != tc.wantErr {
			t.Errorf("%s: err = %v, wantErr %v", name, err, tc.wantErr)
		}
	}
}

func ptrPreset(p SchedulePreset) *SchedulePreset { return &p }

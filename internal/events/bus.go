package events

import "sync"

type Event struct {
	Name    string
	Payload any
}

type Bus struct {
	mu   sync.Mutex
	next uint64
	subs map[uint64]chan Event
}

func New() *Bus {
	return &Bus{subs: map[uint64]chan Event{}}
}

func (b *Bus) Publish(name string, payload any) {
	ev := Event{Name: name, Payload: payload}
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, ch := range b.subs {
		select {
		case ch <- ev:
		default:
		}
	}
}

func (b *Bus) Subscribe() (<-chan Event, func()) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.next++
	id := b.next
	ch := make(chan Event, 256)
	b.subs[id] = ch
	return ch, func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		if existing, ok := b.subs[id]; ok {
			delete(b.subs, id)
			close(existing)
		}
	}
}

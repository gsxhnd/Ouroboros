package workspace

import (
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/persist"
)

type Store struct {
	path string
	mu   sync.Mutex
	doc  Document
	home string
}

func LoadOrCreate(path, home string) (*Store, error) {
	var doc Document
	if _, err := os.Stat(path); err == nil {
		loaded, err := load(path)
		if err != nil {
			return nil, err
		}
		doc = loaded
	} else if os.IsNotExist(err) {
		doc = EmptyDocument()
		if err := persist.AtomicWriteJSON(path, doc); err != nil {
			return nil, err
		}
	} else {
		return nil, core.IO(err)
	}
	if doc.Nodes == nil {
		doc.Nodes = []Node{}
	}
	if doc.Edges == nil {
		doc.Edges = []Edge{}
	}
	return &Store{path: path, doc: doc, home: home}, nil
}

func (s *Store) Home() string { return s.home }

func (s *Store) Get() Document {
	s.mu.Lock()
	defer s.mu.Unlock()
	return cloneDoc(s.doc)
}

func (s *Store) RecordJobResult(runID string, result LastResult, nextRun *time.Time) (Document, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if edge := s.doc.Edge(runID); edge != nil && edge.Sync != nil {
		edge.Sync.LastResult = &result
		if nextRun != nil {
			edge.Sync.NextRun = nextRun
		}
	} else {
		return cloneDoc(s.doc), nil
	}
	s.doc.Revision++
	s.doc.UpdatedAt = time.Now().UTC()
	if err := persist.AtomicWriteJSON(s.path, s.doc); err != nil {
		return Document{}, err
	}
	return cloneDoc(s.doc), nil
}

func (s *Store) SetNextRun(runID string, nextRun *time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if edge := s.doc.Edge(runID); edge != nil && edge.Sync != nil {
		edge.Sync.NextRun = nextRun
	} else {
		return nil
	}
	s.doc.UpdatedAt = time.Now().UTC()
	return persist.AtomicWriteJSON(s.path, s.doc)
}

func (s *Store) mutate(expected uint64, remotes []string, remotesKnown bool, mutate func(*Document) error) (Document, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.doc.Revision != expected {
		return Document{}, core.ConflictDetail(
			"workspace revision is stale: expected "+strconv.FormatUint(expected, 10)+", found "+strconv.FormatUint(s.doc.Revision, 10),
			map[string]any{
				"kind":     "workspace_revision",
				"expected": expected,
				"found":    s.doc.Revision,
			},
		)
	}
	next := cloneDoc(s.doc)
	if err := mutate(&next); err != nil {
		return Document{}, err
	}
	if err := Validate(&next, remotes, remotesKnown, s.home); err != nil {
		return Document{}, err
	}
	next.Revision++
	next.UpdatedAt = time.Now().UTC()
	if next.Nodes == nil {
		next.Nodes = []Node{}
	}
	if next.Edges == nil {
		next.Edges = []Edge{}
	}
	if err := persist.AtomicWriteJSON(s.path, next); err != nil {
		return Document{}, err
	}
	s.doc = next
	return cloneDoc(s.doc), nil
}

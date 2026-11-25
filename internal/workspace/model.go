package workspace

import (
	"encoding/json"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
)

const SchemaVersion = 1

type Document struct {
	SchemaVersion uint32    `json:"schema_version"`
	Revision      uint64    `json:"revision"`
	Nodes         []Node    `json:"nodes"`
	Edges         []Edge    `json:"edges"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func EmptyDocument() Document {
	return Document{
		SchemaVersion: SchemaVersion,
		Nodes:         []Node{},
		Edges:         []Edge{},
		UpdatedAt:     time.Now().UTC(),
	}
}

func (d Document) Node(id string) *Node {
	for i := range d.Nodes {
		if d.Nodes[i].ID == id {
			return &d.Nodes[i]
		}
	}
	return nil
}

func (d Document) Edge(id string) *Edge {
	for i := range d.Edges {
		if d.Edges[i].ID == id {
			return &d.Edges[i]
		}
	}
	return nil
}

func (d Document) NodeLocator(id, home string) (paths.Locator, error) {
	node := d.Node(id)
	if node == nil {
		return paths.Locator{}, core.NotFound("node " + id)
	}
	return node.Locator(home)
}

type Node struct {
	ID        string   `json:"id"`
	Kind      NodeKind `json:"kind"`
	Label     string   `json:"label"`
	LocalPath *string  `json:"local_path,omitempty"`
	Remote    *Remote  `json:"remote,omitempty"`
}

func (n Node) Locator(home string) (paths.Locator, error) {
	switch n.Kind {
	case NodeLocal:
		if n.LocalPath == nil {
			return paths.Locator{}, core.InvalidPath("local node " + n.ID + " is missing local_path")
		}
		return paths.Parse(*n.LocalPath, "", home)
	case NodeRemote:
		if n.Remote == nil {
			return paths.Locator{}, core.InvalidPath("remote node " + n.ID + " is missing remote")
		}
		return paths.Parse(n.Remote.Name, n.Remote.Path, home)
	default:
		return paths.Locator{}, core.InvalidRequest("unknown node kind")
	}
}

type NodeKind string

const (
	NodeLocal  NodeKind = "local"
	NodeRemote NodeKind = "remote"
)

type Remote struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

type Edge struct {
	ID     string       `json:"id"`
	Source string       `json:"source"`
	Target string       `json:"target"`
	Kind   EdgeKind     `json:"kind"`
	Sync   *SyncConfig  `json:"sync,omitempty"`
	Mount  *MountConfig `json:"mount,omitempty"`
}

type EdgeKind string

const (
	EdgeSync  EdgeKind = "sync"
	EdgeMount EdgeKind = "mount"
)

type LastResult struct {
	JobID      string     `json:"job_id"`
	Status     string     `json:"status"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	Error      *string    `json:"error,omitempty"`
}

type MountConfig struct {
	Enabled bool `json:"enabled"`
}

func RelatedEdgeIDs(doc Document, nodeID string) []string {
	var ids []string
	for _, edge := range doc.Edges {
		if edge.Source == nodeID || edge.Target == nodeID {
			ids = append(ids, edge.ID)
		}
	}
	return ids
}

func cloneDoc(doc Document) Document {
	raw, err := json.Marshal(doc)
	if err != nil {
		return doc
	}
	var copy Document
	if err := json.Unmarshal(raw, &copy); err != nil {
		return doc
	}
	if copy.Nodes == nil {
		copy.Nodes = []Node{}
	}
	if copy.Edges == nil {
		copy.Edges = []Edge{}
	}
	return copy
}

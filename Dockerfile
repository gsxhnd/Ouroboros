# syntax=docker/dockerfile:1

FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/ourboros ./cmd/ourboros

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/ourboros /ourboros
EXPOSE 8080
ENTRYPOINT ["/ourboros", "server", "--host", "127.0.0.1", "--port", "8080"]

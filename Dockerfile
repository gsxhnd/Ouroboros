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
# 容器内必须绑定 0.0.0.0 才能被端口映射访问；非回环绑定要求 OURBOROS_TOKEN，
# 未设置时服务会拒绝启动（可诊断的启动错误）。
ENTRYPOINT ["/ourboros", "server", "--host", "0.0.0.0", "--port", "8080"]

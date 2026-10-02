# log-viewer-backend

Local Spring Boot service that lets the Log Viewer UI read pod logs, pods and
secrets from Kubernetes using the kubeconfig files in `%USERPROFILE%\.kube`.

## Run
```
mvn spring-boot:run
# or
mvn package && java -jar target/log-viewer-backend-0.1.0-SNAPSHOT.jar
```
Listens on http://127.0.0.1:8080 (localhost only).

Overrides:
```
mvn spring-boot:run -Dspring-boot.run.arguments="--logviewer.kube.directory=D:\kube --logviewer.kube.default-file=config-dev"
set LOGVIEWER_KUBE_DIRECTORY=D:\kube        (env var alternative)
```

## Smoke test
```
curl http://127.0.0.1:8080/api/status
curl http://127.0.0.1:8080/api/kubeconfigs
curl -X PUT -H "Content-Type: application/json" -d "{\"file\":\"config-dev\"}" http://127.0.0.1:8080/api/kubeconfigs/active
curl http://127.0.0.1:8080/api/namespaces
curl http://127.0.0.1:8080/api/namespaces/my-ns/pods
curl "http://127.0.0.1:8080/api/namespaces/my-ns/pods/my-pod-abc/logs?tailLines=200"
curl http://127.0.0.1:8080/api/namespaces/my-ns/secrets
curl "http://127.0.0.1:8080/api/namespaces/my-ns/secrets/my-secret/entries/password"
```

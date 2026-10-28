# syntax=docker/dockerfile:1
# Spring Boot backend, profile "prod". Build context: ./backend

# ---------------------------------------------------------------- build
FROM maven:3-eclipse-temurin-21 AS build
WORKDIR /workspace

# Dependencies first, so code changes reuse the cached layer.
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline

COPY src ./src
# Tests and Spotless run in the regular build (mvnw verify), not in the image.
RUN --mount=type=cache,target=/root/.m2 mvn -B -q -DskipTests package \
    && cp target/accountant-*.jar app.jar

# -------------------------------------------------------------- runtime
FROM eclipse-temurin:21-jre
WORKDIR /app

ENV TZ=America/Mexico_City \
    SPRING_PROFILES_ACTIVE=prod \
    JAVA_OPTS="-XX:MaxRAMPercentage=75"

RUN groupadd --system accountant && useradd --system --gid accountant --no-create-home accountant
COPY --from=build /workspace/app.jar app.jar
USER accountant

# Only reachable inside the compose network (NGINX proxies /accountant/).
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]

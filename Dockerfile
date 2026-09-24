FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY requisiciones-backend/pom.xml .
RUN mvn -q -B dependency:go-offline
COPY requisiciones-backend/src ./src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
COPY --from=build /app/target/requisiciones-backend-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
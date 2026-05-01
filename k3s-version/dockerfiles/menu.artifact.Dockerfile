FROM eclipse-temurin:17-jre
WORKDIR /app
COPY artifacts/backend/canteen-menu-service.jar app.jar
EXPOSE 8082
ENTRYPOINT ["java","-jar","/app/app.jar"]

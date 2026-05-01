FROM eclipse-temurin:17-jre
WORKDIR /app
COPY artifacts/backend/canteen-order-service.jar app.jar
EXPOSE 8083
ENTRYPOINT ["java","-jar","/app/app.jar"]

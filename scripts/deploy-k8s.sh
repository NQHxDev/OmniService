#!/usr/bin/env sh
set -e

# ==============================================================================
# OmniServices Kubernetes Zero-Downtime Rolling Deployment Script
# Usage: ./scripts/deploy-k8s.sh <service-name> <image-tag> [namespace]
# ==============================================================================

SERVICE_NAME="$1"
IMAGE_TAG="$2"
NAMESPACE="${3:-omni-services}"
TIMEOUT="${ROLLOUT_TIMEOUT:-180s}"

if [ -z "$SERVICE_NAME" ] || [ -z "$IMAGE_TAG" ]; then
   echo "Usage: $0 <service-name> <image-tag> [namespace]"
   exit 1
fi

DEPLOYMENT_NAME="omni-${SERVICE_NAME}"
CONTAINER_NAME="${SERVICE_NAME}"

printf "\n🚀 [Deploy-K8s] Initiating rollout for %s...\n" "$DEPLOYMENT_NAME"
printf "   • Namespace: %s\n" "$NAMESPACE"
printf "   • New Image: %s\n" "$IMAGE_TAG"
printf "   • Timeout:   %s\n\n" "$TIMEOUT"

# Verify kubectl exists
if ! command -v kubectl >/dev/null 2>&1; then
   echo "⚠ kubectl is not installed or not in PATH. Skipping cluster command."
   exit 0
fi

# Check if namespace exists
if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
   echo "ℹ Namespace $NAMESPACE does not exist. Creating it..."
   kubectl create namespace "$NAMESPACE" || true
fi

# Check if deployment exists
if kubectl get deployment "$DEPLOYMENT_NAME" -n "$NAMESPACE" >/dev/null 2>&1; then
   echo "✔ Found existing deployment $DEPLOYMENT_NAME. Updating image..."
   kubectl set image "deployment/$DEPLOYMENT_NAME" "$CONTAINER_NAME=$IMAGE_TAG" -n "$NAMESPACE"
else
   echo "ℹ Deployment $DEPLOYMENT_NAME not found. Applying service manifest template..."
   # Replace placeholders in template if exists
   if [ -f "infra/k8s/templates/service-deployment.yaml" ]; then
      sed -e "s|{{SERVICE_NAME}}|$SERVICE_NAME|g" \
          -e "s|{{IMAGE_TAG}}|$IMAGE_TAG|g" \
          -e "s|{{NAMESPACE}}|$NAMESPACE|g" \
          infra/k8s/templates/service-deployment.yaml | kubectl apply -n "$NAMESPACE" -f -
   else
      echo "⚠ No template found in infra/k8s/templates/service-deployment.yaml. Please ensure manifests exist."
      exit 1
   fi
fi

# Watch rollout status for Zero-Downtime verification
echo "⏳ Waiting for rolling update to complete ($TIMEOUT)..."
if kubectl rollout status "deployment/$DEPLOYMENT_NAME" -n "$NAMESPACE" --timeout="$TIMEOUT"; then
   printf "\n✅ [Deploy-K8s] Rollout completed successfully for %s!\n" "$DEPLOYMENT_NAME"
   exit 0
else
   printf "\n❌ [Deploy-K8s] Rollout FAILED or timed out for %s! Initiating automatic rollback...\n" "$DEPLOYMENT_NAME"
   kubectl rollout undo "deployment/$DEPLOYMENT_NAME" -n "$NAMESPACE" || true
   kubectl rollout status "deployment/$DEPLOYMENT_NAME" -n "$NAMESPACE" --timeout=60s || true
   exit 1
fi

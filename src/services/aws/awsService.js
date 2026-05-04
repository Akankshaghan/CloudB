const config = require('../../../config/config');

/**
 * AWS Real-Data Service
 * All methods here fetch live data from AWS SDK.
 * This is only called when USE_REAL_DATA=true
 */

let ec2Client, cloudwatchClient, s3Client, lambdaClient, rdsClient, dynamoClient, costClient, ecsClient, cloudfrontClient;

function initClients(credentialsObj) {
  if (!credentialsObj || !credentialsObj.accessKeyId || !credentialsObj.secretAccessKey) {
    throw new Error('AWS credentials not provided. Please connect your AWS account.');
  }
  const credentials = {
    credentials: {
      accessKeyId: credentialsObj.accessKeyId,
      secretAccessKey: credentialsObj.secretAccessKey,
    },
    region: credentialsObj.region || config.aws.region || 'us-east-1',
  };

  const { EC2Client } = require('@aws-sdk/client-ec2');
  const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');
  const { S3Client } = require('@aws-sdk/client-s3');
  const { LambdaClient } = require('@aws-sdk/client-lambda');
  const { RDSClient } = require('@aws-sdk/client-rds');
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { CostExplorerClient } = require('@aws-sdk/client-cost-explorer');
  const { ECSClient } = require('@aws-sdk/client-ecs');
  const { CloudFrontClient } = require('@aws-sdk/client-cloudfront');

  ec2Client = new EC2Client(credentials);
  cloudwatchClient = new CloudWatchClient(credentials);
  s3Client = new S3Client(credentials);
  lambdaClient = new LambdaClient(credentials);
  rdsClient = new RDSClient(credentials);
  dynamoClient = new DynamoDBClient(credentials);
  ecsClient = new ECSClient(credentials);
  cloudfrontClient = new CloudFrontClient({ ...credentials, region: credentials.region });
  costClient = new CostExplorerClient({ ...credentials, region: credentials.region });
}

// ─── EC2 ──────────────────────────────────────────────────────────────────────
async function fetchEC2() {
  const { DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
  const { GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');

  const instancesResp = await ec2Client.send(new DescribeInstancesCommand({ Filters: [{ Name: 'instance-state-name', Values: ['running', 'stopped'] }] }));
  const instances = [];

  const endTime = new Date();
  const startTime = new Date(endTime - 24 * 60 * 60 * 1000);

  for (const reservation of instancesResp.Reservations || []) {
    for (const inst of reservation.Instances || []) {
      let cpuUtil = 0;
      try {
        const metricResp = await cloudwatchClient.send(new GetMetricStatisticsCommand({
          Namespace: 'AWS/EC2',
          MetricName: 'CPUUtilization',
          Dimensions: [{ Name: 'InstanceId', Value: inst.InstanceId }],
          StartTime: startTime,
          EndTime: endTime,
          Period: 3600,
          Statistics: ['Average'],
        }));
        const datapoints = metricResp.Datapoints || [];
        if (datapoints.length > 0) {
          cpuUtil = datapoints.reduce((a, d) => a + d.Average, 0) / datapoints.length;
        }
      } catch (_) {}

      const nameTag = (inst.Tags || []).find(t => t.Key === 'Name');
      instances.push({
        id: inst.InstanceId,
        name: nameTag ? nameTag.Value : inst.InstanceId,
        type: inst.InstanceType,
        state: inst.State?.Name,
        region: config.aws.region,
        az: inst.Placement?.AvailabilityZone,
        cpu_utilization: parseFloat(cpuUtil.toFixed(2)),
        monthly_cost: 0, // Real billing via Cost Explorer
        launch_time: inst.LaunchTime,
        public_ip: inst.PublicIpAddress || null,
        tags: Object.fromEntries((inst.Tags || []).map(t => [t.Key, t.Value])),
        recommendations: cpuUtil < 10 ? ['⚠️ Low CPU utilization — consider right-sizing or stopping this instance'] : [],
      });
    }
  }
  return instances;
}

// ─── LAMBDA ───────────────────────────────────────────────────────────────────
async function fetchLambda() {
  const { ListFunctionsCommand } = require('@aws-sdk/client-lambda');
  const resp = await lambdaClient.send(new ListFunctionsCommand({}));
  return (resp.Functions || []).map(fn => ({
    id: fn.FunctionName,
    name: fn.FunctionName,
    runtime: fn.Runtime,
    memory_mb: fn.MemorySize,
    timeout_sec: fn.Timeout,
    monthly_cost: 0,
    region: config.aws.region,
    recommendations: [],
  }));
}

// ─── S3 ───────────────────────────────────────────────────────────────────────
async function fetchS3() {
  const { ListBucketsCommand } = require('@aws-sdk/client-s3');
  const resp = await s3Client.send(new ListBucketsCommand({}));
  return (resp.Buckets || []).map(b => ({
    id: b.Name,
    name: b.Name,
    monthly_cost: 0,
    recommendations: [],
  }));
}

// ─── COST EXPLORER ────────────────────────────────────────────────────────────
async function fetchCosts() {
  const { GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const resp = await costClient.send(new GetCostAndUsageCommand({
    TimePeriod: { Start: startDate, End: endDate },
    Granularity: 'MONTHLY',
    GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    Metrics: ['UnblendedCost'],
  }));

  const services = {};
  for (const result of resp.ResultsByTime || []) {
    for (const group of result.Groups || []) {
      const name = group.Keys[0];
      const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
      services[name] = (services[name] || 0) + cost;
    }
  }
  return services;
}

// ─── MAIN FETCH ALL ───────────────────────────────────────────────────────────
async function fetchAll(credentials) {
  initClients(credentials);

  const [ec2Instances, lambdaFunctions, s3Buckets, costs] = await Promise.allSettled([
    fetchEC2(), fetchLambda(), fetchS3(), fetchCosts(),
  ]);

  const totalCost = Object.values(costs.value || {}).reduce((a, v) => a + v, 0);
  const serviceCosts = costs.value || {};

  return {
    meta: { cloud: 'aws', region: config.aws.region, last_updated: new Date().toISOString() },
    summary: {
      total_monthly_cost: parseFloat(totalCost.toFixed(2)),
      active_services: 8,
      total_resources: (ec2Instances.value || []).length,
      cost_alerts: 0,
      projected_monthly_cost: parseFloat((totalCost * 1.1).toFixed(2)),
    },
    services: {
      ec2: { service_name: 'Amazon EC2', monthly_cost: serviceCosts['Amazon Elastic Compute Cloud - Compute'] || 0, instances: ec2Instances.value || [] },
      lambda: { service_name: 'AWS Lambda', monthly_cost: serviceCosts['AWS Lambda'] || 0, functions: lambdaFunctions.value || [] },
      s3: { service_name: 'Amazon S3', monthly_cost: serviceCosts['Amazon Simple Storage Service'] || 0, buckets: s3Buckets.value || [] },
    },
    alerts: [],
    top_cost_services: Object.entries(serviceCosts).map(([service, cost]) => ({ service, cost: parseFloat(cost.toFixed(2)) })).sort((a, b) => b.cost - a.cost).slice(0, 10),
  };
}

module.exports = { fetchAll };

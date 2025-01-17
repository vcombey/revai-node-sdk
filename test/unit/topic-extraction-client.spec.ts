import { TopicExtractionClient, TopicExtractionJob, TopicExtractionJobOptions, TopicExtractionResult, TopicExtractionResultOptions } from '../../src';
import { ApiRequestHandler } from '../../src/api-request-handler';
import { GetListOfJobsOptions } from '../../src/models/GetListOfJobsOptions';

jest.mock('../../src/api-request-handler');

describe('topic-extraction-client', () => {
    let sut: TopicExtractionClient;
    let mockMakeApiRequest: jest.Mock;

    const jobId = 'Umx5c6F7pH7r';
    const otherJobId = 'EMx5c67p3dr';
    const jobDetails = {
        id: jobId,
        status: 'completed',
        created_on: '2018-05-05T23:23:22.29Z',
        type: 'topic_extraction'
    } as TopicExtractionJob;

    beforeEach(() => {
        mockMakeApiRequest = jest.fn();
        (ApiRequestHandler as jest.Mock<ApiRequestHandler>).mockImplementationOnce(() => ({
            makeApiRequest: mockMakeApiRequest
        }));
        sut = new TopicExtractionClient('testtoken');
    });

    describe('getJobDetails', () => {
        it('get job by id', async () => {
            mockMakeApiRequest.mockResolvedValue(jobDetails);

            const job = await sut.getJobDetails(jobId);

            expect(mockMakeApiRequest).toBeCalledWith('get', `/jobs/${jobDetails.id}`, {}, 'json');
            expect(mockMakeApiRequest).toBeCalledTimes(1);
            expect(job).toEqual(jobDetails);
        });
    });

    describe('getListOfJobs', () => {
        const jobDetails2 = {
            id: otherJobId,
            status: 'completed',
            created_on: '2013-05-05T23:23:22.29Z',
            type: 'topic_extraction'
        } as TopicExtractionJob;

        it('get list of jobs', async () => {
            mockMakeApiRequest.mockResolvedValue([jobDetails, jobDetails2]);

            const jobs = await sut.getListOfJobs();

            expect(jobs).toEqual([jobDetails, jobDetails2]);
            expect(mockMakeApiRequest).toBeCalledWith('get', `/jobs`, {}, 'json');
            expect(mockMakeApiRequest).toBeCalledTimes(1);
        });

        it('get list of jobs with params', async () => {
            const params = {
                limit: 5,
                startingafter: otherJobId
            } as GetListOfJobsOptions;
            mockMakeApiRequest.mockResolvedValue([jobDetails, jobDetails2]);

            const jobs = await sut.getListOfJobs(params);

            expect(jobs).toEqual([jobDetails, jobDetails2]);
            expect(mockMakeApiRequest).toBeCalledWith('get',
                `/jobs?limit=5&startingafter=${otherJobId}`, {}, 'json');
            expect(mockMakeApiRequest).toBeCalledTimes(1);
        });
    });

    describe('submitJobFromText', () => {
        const text = 'some text submission';

        it('submit text job', async () => {
            mockMakeApiRequest.mockResolvedValue(jobDetails);

            const job = await sut.submitJobFromText(text);

            expect(mockMakeApiRequest).toBeCalledWith('post', '/jobs',
                { 'Content-Type': 'application/json' }, 'json', { 'text': text });
            expect(mockMakeApiRequest).toBeCalledTimes(1);
            expect(job).toEqual(jobDetails);
        });

        it('submit text job with options', async () => {
            mockMakeApiRequest.mockResolvedValue(jobDetails);
            const options = {
                metadata: 'metadata field',
            } as TopicExtractionJobOptions;

            const job = await sut.submitJobFromText(text, options);

            expect(mockMakeApiRequest).toBeCalledWith('post', '/jobs',
                { 'Content-Type': 'application/json' }, 'json', { ...options, 'text': text });
            expect(mockMakeApiRequest).toBeCalledTimes(1);
            expect(job).toEqual(jobDetails);
        });
    });

    describe('submitJobFromJson', () => {
        const transcript = {
            monologues: [{
                speaker: 1,
                elements: [
                    {
                        'type': 'text',
                        'value': 'Hello',
                        'ts': 0.5,
                        'end_ts': 1.5,
                        'confidence': 1
                    },
                    {
                        'type': 'text',
                        'value': 'World',
                        'ts': 1.75,
                        'end_ts': 2.85,
                        'confidence': 0.8
                    },
                    {
                        'type': 'punct',
                        'value': '.'
                    }
                ]
            }]
        };

        it('submit transcript job', async () => {
            mockMakeApiRequest.mockResolvedValue(jobDetails);
            const expectedOptions = { 'json': transcript };

            const job = await sut.submitJobFromJson(transcript);

            expect(mockMakeApiRequest).toBeCalledWith('post', '/jobs',
                { 'Content-Type': 'application/json' }, 'json', expectedOptions);
            expect(mockMakeApiRequest).toBeCalledTimes(1);
            expect(job).toEqual(jobDetails);
        });

        it('submit transcript job with options', async () => {
            mockMakeApiRequest.mockResolvedValue(jobDetails);
            const options = {
                metadata: 'metadata field',
            } as TopicExtractionJobOptions;
            const expectedOptions = { ...options, 'json': transcript };

            const job = await sut.submitJobFromJson(transcript, options);

            expect(mockMakeApiRequest).toBeCalledWith('post', '/jobs',
                { 'Content-Type': 'application/json' }, 'json', expectedOptions);
            expect(mockMakeApiRequest).toBeCalledTimes(1);
            expect(job).toEqual(jobDetails);
        });
    });

    describe('getResult', () => {
        const jobResult = {
            topics: [
                {
                    topic_name: "apples",
                    score: 0.9,
                    informants: [
                        { content: "Apples are tasty." }, 
                        { content: "Apples are very sweet." } 
                    ]
                }
            ]
        } as TopicExtractionResult;

        it('get job result', async () => {
            mockMakeApiRequest.mockResolvedValue(jobResult);

            const res = await sut.getResult(jobId);

            expect(mockMakeApiRequest).toBeCalledWith('get', `/jobs/${jobId}/result`,
                { 'Accept': 'application/vnd.rev.topic.v1.0+json' }, 'json');
            expect(mockMakeApiRequest).toBeCalledTimes(1);
            expect(res).toEqual(jobResult);
        });

        it('get job result with options', async () => {
            mockMakeApiRequest.mockResolvedValue(jobResult);
            const options = {
                threshold: 0.5
            } as TopicExtractionResultOptions;

            const res = await sut.getResult(jobId, options);

            expect(mockMakeApiRequest).toBeCalledWith('get', 
                `/jobs/${jobId}/result?threshold=0.5`, 
                { 'Accept': 'application/vnd.rev.topic.v1.0+json' }, 'json');
            expect(mockMakeApiRequest).toBeCalledTimes(1);
            expect(res).toEqual(jobResult);
        });
    });

    describe('deleteJob', () => {
        it('delete job by id', async () => {
            mockMakeApiRequest.mockResolvedValue(null);

            await sut.deleteJob(jobId);

            expect(mockMakeApiRequest).toBeCalledWith('delete', `/jobs/${jobId}`, {}, 'text');
            expect(mockMakeApiRequest).toBeCalledTimes(1);
        });
    });
});

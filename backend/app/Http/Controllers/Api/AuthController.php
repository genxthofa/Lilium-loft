<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WriteSetting;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;
use PHPOpenSourceSaver\JWTAuth\Exceptions\JWTException;

class AuthController extends Controller
{
    #[OA\Post(
        path: '/api/v1/auth/login',
        operationId: 'authLogin',
        summary: 'Exchange admin credentials for a JWT',
        description: 'Returns a signed JWT access token. Nothing is sent to WooCommerce. Limited to 5 attempts per minute.',
        tags: ['Auth'],
        requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(
            required: ['email', 'password'],
            properties: [
                new OA\Property(property: 'email', type: 'string', format: 'email', example: 'admin@example.com'),
                new OA\Property(property: 'password', type: 'string', format: 'password'),
            ],
        )),
        responses: [
            new OA\Response(response: 200, description: 'Token issued', content: new OA\JsonContent(ref: '#/components/schemas/TokenResponse')),
            new OA\Response(response: 422, description: 'Invalid credentials', content: new OA\JsonContent(ref: '#/components/schemas/ValidationError')),
            new OA\Response(response: 429, description: 'Too many attempts'),
        ],
    )]
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! $token = auth('api')->attempt($credentials)) {
            throw ValidationException::withMessages(['email' => ['The provided credentials are incorrect.']]);
        }

        $user = auth('api')->user();
        if ($user && $user->can_write) {
            WriteSetting::query()->update(['enabled' => true]);
        }

        return $this->tokenResponse($token);
    }

    #[OA\Post(
        path: '/api/v1/auth/refresh',
        operationId: 'authRefresh',
        summary: 'Swap the current JWT for a fresh one',
        description: 'The old token is blacklisted. Works while the token is within the refresh window (default 2 weeks from issue), even if it has already expired.',
        security: [['bearerAuth' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'New token', content: new OA\JsonContent(ref: '#/components/schemas/TokenResponse')),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
        ],
    )]
    public function refresh(): JsonResponse
    {
        try {
            return $this->tokenResponse(auth('api')->refresh());
        } catch (JWTException) {
            // No token, a token past the refresh window, or one that was logged out.
            throw new AuthenticationException('Unauthenticated.');
        }
    }

    #[OA\Get(
        path: '/api/v1/auth/me',
        operationId: 'authMe',
        summary: 'Current authenticated user',
        security: [['bearerAuth' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'OK', content: new OA\JsonContent(properties: [
                new OA\Property(property: 'id', type: 'integer'),
                new OA\Property(property: 'name', type: 'string'),
                new OA\Property(property: 'email', type: 'string'),
            ])),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
        ],
    )]
    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user('api')->only(['id', 'name', 'email']));
    }

    #[OA\Post(
        path: '/api/v1/auth/logout',
        operationId: 'authLogout',
        summary: 'Invalidate the current JWT',
        description: 'Adds the token to the blacklist so it can no longer be used.',
        security: [['bearerAuth' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 204, description: 'Token invalidated'),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
        ],
    )]
    public function logout(): JsonResponse
    {
        auth('api')->logout();

        return response()->json(null, 204);
    }

    private function tokenResponse(string $token): JsonResponse
    {
        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
        ]);
    }
}
